using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.VitalSigns;

public static class VitalSignRangeRules
{
    public static string GetDefaultUnit(VitalSignType type) => type switch
    {
        VitalSignType.HeartRate => "bpm",
        VitalSignType.Steps => "count",
        VitalSignType.BloodPressureSystolic => "mmHg",
        VitalSignType.BloodPressureDiastolic => "mmHg",
        VitalSignType.Weight => "kg",
        VitalSignType.Glucose => "mg/dL",
        VitalSignType.SpO2 => "%",
        _ => "unit"
    };

    public static void ValidateValue(VitalSignType type, decimal value)
    {
        var (min, max) = type switch
        {
            VitalSignType.HeartRate => (30m, 220m),
            VitalSignType.Steps => (0m, 200_000m),
            VitalSignType.BloodPressureSystolic => (40m, 280m),
            VitalSignType.BloodPressureDiastolic => (20m, 180m),
            VitalSignType.Weight => (1m, 500m),
            VitalSignType.Glucose => (20m, 600m),
            VitalSignType.SpO2 => (50m, 100m),
            _ => (0m, decimal.MaxValue)
        };

        if (value < min || value > max)
            throw new BusinessRuleException(
                "VITAL_OUT_OF_RANGE",
                $"El valor para {type} debe estar entre {min} y {max}.");
    }
}
