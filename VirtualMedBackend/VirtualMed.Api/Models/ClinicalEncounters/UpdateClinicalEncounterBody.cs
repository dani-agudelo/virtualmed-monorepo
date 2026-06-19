using VirtualMed.Domain.Enums;

namespace VirtualMed.Api.Models.ClinicalEncounters;

public class UpdateClinicalEncounterBody
{
    public EncounterType? EncounterType { get; set; }
    public DateTime? StartAt { get; set; }
    public DateTime? EndAt { get; set; }
    public string? ChiefComplaint { get; set; }
    public string? CurrentCondition { get; set; }
    public string? PhysicalExam { get; set; }
    public string? Assessment { get; set; }
    public string? Plan { get; set; }
    public string? Notes { get; set; }
    public string? RecordingUrl { get; set; }
    public bool? IsLocked { get; set; }
    public IReadOnlyList<UpdateClinicalEncounterDiagnosisBody>? Diagnoses { get; set; }
}

public class UpdateClinicalEncounterDiagnosisBody
{
    public string Icd10Code { get; set; } = null!;
    public string Description { get; set; } = null!;
    public DiagnosisType Type { get; set; }
}
