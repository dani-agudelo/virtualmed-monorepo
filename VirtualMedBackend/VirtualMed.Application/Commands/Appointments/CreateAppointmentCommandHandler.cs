using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Commands.Appointments;

public class CreateAppointmentCommandHandler : IRequestHandler<CreateAppointmentCommand, Guid>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public CreateAppointmentCommandHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<Guid> Handle(CreateAppointmentCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId
                     ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = _currentUserService.Role ?? string.Empty;

        Guid doctorEntityId;

        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            if (!request.DoctorId.HasValue)
                throw new BusinessRuleException("DoctorId es obligatorio al crear una cita como administrador.");

            doctorEntityId = request.DoctorId.Value;
        }
        else if (IsDoctorLikeRole(role))
        {
            var doctor = await _context.Set<Doctor>()
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.UserId == userId, cancellationToken);

            if (doctor is null)
                throw new ForbiddenException("Solo los usuarios con perfil médico pueden crear citas.");

            doctorEntityId = doctor.Id;

            if (request.DoctorId.HasValue && request.DoctorId.Value != doctorEntityId)
                throw new ForbiddenException("No puede asignar un médico distinto al usuario autenticado.");
        }
        else
            throw new ForbiddenException("No tiene permiso para crear citas.");

        var now = DateTime.UtcNow;

        if (request.ScheduledAt < now.AddHours(12))
            throw new BusinessRuleException("APPOINTMENT_MIN_ADVANCE_TIME", "La cita debe ser agendada con al menos 12 horas de antelación.");

        var requestedStart = request.ScheduledAt;
        var requestedEnd = request.ScheduledAt.AddMinutes(request.DurationMinutes);

        var hasConflict = await _context.Set<Appointment>()
            .AsNoTracking()
            .Where(a => a.DoctorId == doctorEntityId
                        && a.Status != AppointmentStatus.Cancelled
                        && a.Status != AppointmentStatus.NoShow)
            .AnyAsync(a => a.ScheduledAt < requestedEnd
                           && a.ScheduledAt.AddMinutes(a.DurationMinutes) > requestedStart,
                cancellationToken);

        if (hasConflict)
            throw new BusinessRuleException("DOCTOR_BUSY", "El doctor está ocupado en el horario seleccionado.");

        var appointment = new Appointment
        {
            Id = Guid.NewGuid(),
            PatientId = request.PatientId,
            DoctorId = doctorEntityId,
            ScheduledAt = request.ScheduledAt,
            DurationMinutes = request.DurationMinutes,
            Reason = request.Reason,
            Status = request.Status,
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.Add(appointment);
        await _context.SaveChangesAsync(cancellationToken);
        return appointment.Id;
    }

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}
