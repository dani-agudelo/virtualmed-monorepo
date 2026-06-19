using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Queries.VitalSigns;

public class HealthAlertDto
{
    public Guid Id { get; init; }
    public Guid PatientId { get; init; }
    public Guid? VitalSignReadingId { get; init; }
    public string AlertType { get; init; } = null!;
    public string Message { get; init; } = null!;
    public AlertSeverity Severity { get; init; }
    public bool IsRead { get; init; }
    public DateTime OccurredAt { get; init; }
}
