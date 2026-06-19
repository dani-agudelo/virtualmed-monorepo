using MediatR;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Commands.Appointments;

public record CreateAppointmentCommand(
    Guid PatientId,
    Guid? DoctorId,
    DateTime ScheduledAt,
    int DurationMinutes,
    string? Reason,
    AppointmentStatus Status = AppointmentStatus.Scheduled) : IRequest<Guid>;
