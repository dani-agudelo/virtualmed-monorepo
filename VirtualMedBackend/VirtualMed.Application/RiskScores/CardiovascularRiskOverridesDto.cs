namespace VirtualMed.Application.RiskScores;

/// <summary>
/// Valores que el paciente puede completar o corregir al calcular el riesgo cardiovascular.
/// </summary>
public record CardiovascularRiskOverridesDto(
    int? Smoker,
    int? PhysicalActivityLevel,
    int? SystolicBp,
    int? DiastolicBp,
    double? Bmi,
    int? FamilyHistoryCvd,
    int? CholesterolTotal,
    int? GlucoseMgDl);
