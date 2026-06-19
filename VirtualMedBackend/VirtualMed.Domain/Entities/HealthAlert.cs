using VirtualMed.Domain.Enums;

namespace VirtualMed.Domain.Entities;

public class HealthAlert
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    public Guid? VitalSignReadingId { get; set; }
    public VitalSignReading? VitalSignReading { get; set; }

    public string AlertType { get; set; } = null!;
    public string Message { get; set; } = null!;
    public AlertSeverity Severity { get; set; }
    public bool IsRead { get; set; }
    public DateTime OccurredAt { get; set; }
}
