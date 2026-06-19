namespace VirtualMed.Domain.Entities;

public class Prescription
{
    public Guid Id { get; set; }
    public Guid EncounterId { get; set; }
    public ClinicalEncounter Encounter { get; set; } = null!;

    public Guid DoctorId { get; set; }
    public Doctor Doctor { get; set; } = null!;

    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    public string PrescriptionNumber { get; set; } = null!;
    public DateTime IssuedAt { get; set; }
    public DateOnly? ValidUntil { get; set; }
    public string? DoctorSignatureHash { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<PrescriptionMedication> Medications { get; set; } = new List<PrescriptionMedication>();
}

