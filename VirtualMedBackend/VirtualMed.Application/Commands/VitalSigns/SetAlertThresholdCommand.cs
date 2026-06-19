using MediatR;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Commands.VitalSigns;

public record SetAlertThresholdCommand(
    Guid? PatientId,
    Guid? Id,
    VitalSignType VitalSignType,
    decimal MinValue,
    decimal MaxValue,
    bool IsActive,
    AlertLevel AlertLevel) : IRequest<Guid>;
