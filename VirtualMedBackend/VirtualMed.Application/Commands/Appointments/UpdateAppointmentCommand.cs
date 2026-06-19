using MediatR;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Commands.Appointments;

public record UpdateAppointmentCommand(
    Guid Id,
    AppointmentStatus? Status,
    DateTime? ScheduledAt,
    int? DurationMinutes,
    string? Reason) : IRequest;
