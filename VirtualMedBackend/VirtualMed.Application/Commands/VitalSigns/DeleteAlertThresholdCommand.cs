using MediatR;

namespace VirtualMed.Application.Commands.VitalSigns;

public record DeleteAlertThresholdCommand(Guid Id, Guid? PatientId) : IRequest<Unit>;
