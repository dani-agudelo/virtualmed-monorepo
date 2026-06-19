namespace VirtualMed.Application.Queries.Prescriptions;

public class PrescriptionDetailDto
{
    public Guid Id { get; set; }
    public Guid EncounterId { get; set; }
    public Guid DoctorId { get; set; }
    public Guid PatientId { get; set; }
    public string PrescriptionNumber { get; set; } = string.Empty;
    public DateTime IssuedAt { get; set; }
    public DateOnly? ValidUntil { get; set; }
    public string? DoctorSignatureHash { get; set; }
    public IReadOnlyCollection<PrescriptionMedicationLineDto> Medications { get; set; } = [];
}

public class PrescriptionMedicationLineDto
{
    public Guid MedicationId { get; set; }
    public string MedicationName { get; set; } = string.Empty;
    public string Dosage { get; set; } = string.Empty;
    public string Frequency { get; set; } = string.Empty;
    public int DurationDays { get; set; }
    public string? Instructions { get; set; }
}
