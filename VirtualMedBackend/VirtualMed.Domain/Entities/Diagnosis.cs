using VirtualMed.Domain.Enums;

namespace VirtualMed.Domain.Entities;

public class Diagnosis
{
    public Guid Id { get; set; }
    public Guid EncounterId { get; set; }
    public ClinicalEncounter Encounter { get; set; } = null!;

    public string Icd10Code { get; set; } = null!;
    public string Description { get; set; } = null!;
    public DiagnosisType Type { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

