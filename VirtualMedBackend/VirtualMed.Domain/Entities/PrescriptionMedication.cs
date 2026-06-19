namespace VirtualMed.Domain.Entities;

public class PrescriptionMedication
{
    public Guid PrescriptionId { get; set; }
    public Prescription Prescription { get; set; } = null!;

    public Guid MedicationId { get; set; }
    public Medication Medication { get; set; } = null!;

    public string Dosage { get; set; } = null!;
    public string Frequency { get; set; } = null!;
    public int DurationDays { get; set; }
    public string? Instructions { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

