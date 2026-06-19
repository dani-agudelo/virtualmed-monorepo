using MediatR;
using VirtualMed.Application.VitalSigns;

namespace VirtualMed.Application.Commands.VitalSigns;

public record RecordVitalSignReadingCommand(
    Guid? PatientId,
    IReadOnlyList<VitalSignReadingItemDto> Readings) : IRequest<RecordVitalSignReadingResult>;

public record RecordVitalSignReadingResult(
    int CreatedCount,
    IReadOnlyList<Guid> ReadingIds);
