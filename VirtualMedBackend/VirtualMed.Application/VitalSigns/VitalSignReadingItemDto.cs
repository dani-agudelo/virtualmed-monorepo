using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.VitalSigns;

public record VitalSignReadingItemDto(
    VitalSignType Type,
    decimal Value,
    string? Unit,
    DateTime? ReadingAt,
    string? Notes);
