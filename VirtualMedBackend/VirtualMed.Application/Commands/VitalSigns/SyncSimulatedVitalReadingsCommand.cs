using MediatR;
using VirtualMed.Application.VitalSigns;

namespace VirtualMed.Application.Commands.VitalSigns;

public record SyncSimulatedVitalReadingsCommand(
    Guid? PatientId,
    IReadOnlyList<VitalSignReadingItemDto> Readings) : IRequest<SyncSimulatedVitalReadingsResult>;

public record SyncSimulatedVitalReadingsResult(
    int Accepted,
    IReadOnlyList<SimulatedVitalRejectionDto> Rejected,
    IReadOnlyDictionary<string, int> SummaryByType);

public record SimulatedVitalRejectionDto(int Index, string Code, string Message);
