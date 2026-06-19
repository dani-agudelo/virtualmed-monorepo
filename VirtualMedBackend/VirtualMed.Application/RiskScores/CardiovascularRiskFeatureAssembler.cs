using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.RiskScores;

public interface ICardiovascularRiskFeatureAssembler
{
    Task<(CardiovascularRiskApiRequest Request, string InputSnapshotJson)> AssembleAsync(
        Guid patientId,
        CardiovascularRiskOverridesDto? overrides,
        CancellationToken cancellationToken);
}

public class CardiovascularRiskFeatureAssembler : ICardiovascularRiskFeatureAssembler
{
    private readonly IApplicationDbContext _context;

    public CardiovascularRiskFeatureAssembler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<(CardiovascularRiskApiRequest Request, string InputSnapshotJson)> AssembleAsync(
        Guid patientId,
        CardiovascularRiskOverridesDto? overrides,
        CancellationToken cancellationToken)
    {
        overrides ??= new CardiovascularRiskOverridesDto(null, null, null, null, null, null, null, null);

        var patient = await _context.Set<Patient>()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == patientId, cancellationToken)
            ?? throw new NotFoundException("Paciente", patientId);

        var age = CalculateAgeYears(patient.DateOfBirth);
        if (age < 30 || age > 65)
            throw new BusinessRuleException(
                "RISK_AGE_OUT_OF_RANGE",
                $"La edad ({age} años) debe estar entre 30 y 65 para el modelo cardiovascular.");

        var sex = MapSex(patient.Gender);

        var latestVitals = await _context.Set<VitalSignReading>()
            .AsNoTracking()
            .Where(r => r.PatientId == patientId
                        && (r.VitalSignType == VitalSignType.BloodPressureSystolic
                            || r.VitalSignType == VitalSignType.BloodPressureDiastolic
                            || r.VitalSignType == VitalSignType.Weight))
            .OrderByDescending(r => r.ReadingAt)
            .ToListAsync(cancellationToken);

        var systolicFromVitals = latestVitals
            .FirstOrDefault(r => r.VitalSignType == VitalSignType.BloodPressureSystolic)?.Value;
        var diastolicFromVitals = latestVitals
            .FirstOrDefault(r => r.VitalSignType == VitalSignType.BloodPressureDiastolic)?.Value;
        var weightKg = latestVitals
            .FirstOrDefault(r => r.VitalSignType == VitalSignType.Weight)?.Value;

        var systolicBp = ResolveInt(overrides.SystolicBp, systolicFromVitals, "systolic_bp");
        var diastolicBp = ResolveInt(overrides.DiastolicBp, diastolicFromVitals, "diastolic_bp");

        if (systolicBp <= diastolicBp)
            throw new BusinessRuleException(
                "RISK_BP_INVALID",
                "La presión sistólica debe ser mayor que la diastólica.");

        var bmi = ResolveBmi(overrides.Bmi, weightKg);
        var smoker = ResolveBinary(overrides.Smoker, "smoker");
        var physicalActivity = ResolveBinary(overrides.PhysicalActivityLevel, "physical_activity_level");

        ValidateOptionalOrdinal(overrides.CholesterolTotal, "cholesterol_total");
        ValidateOptionalOrdinal(overrides.GlucoseMgDl, "glucose_mg_dl");

        var request = new CardiovascularRiskApiRequest
        {
            Age = age,
            Sex = sex,
            Bmi = bmi,
            SystolicBp = systolicBp,
            DiastolicBp = diastolicBp,
            Smoker = smoker,
            PhysicalActivityLevel = physicalActivity,
            FamilyHistoryCvd = overrides.FamilyHistoryCvd,
            CholesterolTotal = overrides.CholesterolTotal,
            GlucoseMgDl = overrides.GlucoseMgDl
        };

        var snapshot = new
        {
            sources = new
            {
                age = "patient.dateOfBirth",
                sex = "patient.gender",
                systolic_bp = overrides.SystolicBp.HasValue ? "override" : systolicFromVitals.HasValue ? "vitalSignReading" : "required",
                diastolic_bp = overrides.DiastolicBp.HasValue ? "override" : diastolicFromVitals.HasValue ? "vitalSignReading" : "required",
                bmi = overrides.Bmi.HasValue ? "override" : weightKg.HasValue ? "derivedFromWeight" : "required",
                smoker = overrides.Smoker.HasValue ? "override" : "required",
                physical_activity_level = overrides.PhysicalActivityLevel.HasValue ? "override" : "required"
            },
            payload = request
        };

        return (request, JsonSerializer.Serialize(snapshot));
    }

    private static int CalculateAgeYears(DateOnly dateOfBirth)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var age = today.Year - dateOfBirth.Year;
        if (dateOfBirth > today.AddYears(-age))
            age--;
        return age;
    }

    private static int MapSex(string gender) =>
        string.Equals(gender, "male", StringComparison.OrdinalIgnoreCase) ? 1 : 0;

    private static int ResolveInt(int? overrideValue, decimal? fromVitals, string fieldName)
    {
        if (overrideValue.HasValue)
            return overrideValue.Value;

        if (fromVitals.HasValue)
            return (int)Math.Round(fromVitals.Value, MidpointRounding.AwayFromZero);

        throw new BusinessRuleException(
            "RISK_FEATURES_INCOMPLETE",
            $"Falta el valor de {fieldName}. Regístrelo en signos vitales o envíelo en overrides.");
    }

    private static double ResolveBmi(double? overrideBmi, decimal? weightKg)
    {
        if (overrideBmi.HasValue)
            return Math.Round(overrideBmi.Value, 1);

        if (weightKg.HasValue)
        {
            // Sin altura en el dominio: estimación conservadora para demo (IMC ~ peso/altura² con altura 1.70 m).
            const double defaultHeightM = 1.70;
            var bmi = (double)weightKg.Value / (defaultHeightM * defaultHeightM);
            return Math.Round(bmi, 1);
        }

        throw new BusinessRuleException(
            "RISK_FEATURES_INCOMPLETE",
            "Falta BMI. Envíelo en overrides o registre peso en signos vitales.");
    }

    private static int ResolveBinary(int? overrideValue, string fieldName)
    {
        if (!overrideValue.HasValue)
            throw new BusinessRuleException(
                "RISK_FEATURES_INCOMPLETE",
                $"Falta {fieldName} (0 o 1). Envíelo en overrides.");

        if (overrideValue is < 0 or > 1)
            throw new BusinessRuleException("RISK_INVALID_BINARY", $"{fieldName} debe ser 0 o 1.");

        return overrideValue.Value;
    }

    private static void ValidateOptionalOrdinal(int? value, string fieldName)
    {
        if (!value.HasValue)
            return;

        if (value is < 1 or > 3)
            throw new BusinessRuleException(
                "RISK_INVALID_ORDINAL",
                $"{fieldName} debe ser 1, 2, 3 o null (ordinal del modelo, no mg/dL).");
    }
}
