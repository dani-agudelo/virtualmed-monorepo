using VirtualMed.Domain.Enums;

namespace VirtualMed.Domain.Entities;

public class VitalSignReading
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    public VitalSignType VitalSignType { get; set; }
    public decimal Value { get; set; }
    public string Unit { get; set; } = null!;
    public DateTime ReadingAt { get; set; }
    public VitalReadingSource Source { get; set; }
    public Guid? DeviceId { get; set; }
    public string? RawPayload { get; set; }
    public DateTime CreatedAt { get; set; }
}
