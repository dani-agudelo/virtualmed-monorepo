using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Queries.VitalSigns;

public class VitalSignReadingDto
{
    public Guid Id { get; init; }
    public Guid PatientId { get; init; }
    public VitalSignType VitalSignType { get; init; }
    public decimal Value { get; init; }
    public string Unit { get; init; } = null!;
    public DateTime ReadingAt { get; init; }
    public VitalReadingSource Source { get; init; }
    public DateTime CreatedAt { get; init; }
}
