using VirtualMed.Domain.Enums;

namespace VirtualMed.Api.Models.VitalSigns;

public class SetAlertThresholdRequest
{
    public Guid? PatientId { get; set; }
    public VitalSignType VitalSignType { get; set; }
    public decimal MinValue { get; set; }
    public decimal MaxValue { get; set; }
    public bool IsActive { get; set; } = true;
    public AlertLevel AlertLevel { get; set; } = AlertLevel.Medium;
}
