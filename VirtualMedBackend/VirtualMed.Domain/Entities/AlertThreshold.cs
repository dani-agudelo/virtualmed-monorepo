using VirtualMed.Domain.Enums;

namespace VirtualMed.Domain.Entities;

public class AlertThreshold
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    public VitalSignType VitalSignType { get; set; }
    public decimal MinValue { get; set; }
    public decimal MaxValue { get; set; }
    public bool IsActive { get; set; } = true;
    public AlertLevel AlertLevel { get; set; }
    public DateTime UpdatedAt { get; set; }
}
