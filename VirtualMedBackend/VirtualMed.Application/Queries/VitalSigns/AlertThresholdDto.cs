using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Queries.VitalSigns;

public class AlertThresholdDto
{
    public Guid Id { get; init; }
    public Guid PatientId { get; init; }
    public VitalSignType VitalSignType { get; init; }
    public decimal MinValue { get; init; }
    public decimal MaxValue { get; init; }
    public bool IsActive { get; init; }
    public AlertLevel AlertLevel { get; init; }
    public DateTime UpdatedAt { get; init; }
}
