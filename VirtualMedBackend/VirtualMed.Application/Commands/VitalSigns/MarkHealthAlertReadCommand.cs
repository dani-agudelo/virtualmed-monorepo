using MediatR;

namespace VirtualMed.Application.Commands.VitalSigns;

public record MarkHealthAlertReadCommand(Guid AlertId) : IRequest<Unit>;
