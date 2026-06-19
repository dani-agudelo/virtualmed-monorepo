using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.Appointments;

public class UpdateAppointmentCommandHandler : IRequestHandler<UpdateAppointmentCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public UpdateAppointmentCommandHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task Handle(UpdateAppointmentCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId
                     ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = _currentUserService.Role ?? string.Empty;

        var appointment = await _context.Set<Appointment>()
            .FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);

        if (appointment is null)
            throw new NotFoundException("Cita", request.Id);

        await EnsureCanModifyAppointmentAsync(appointment, userId, role, cancellationToken);

        if (request.Status.HasValue)
        {
            var cancellationWindow = TimeSpan.FromHours(24);
            appointment.UpdateStatus(request.Status.Value, cancellationWindow);
        }

        if (request.ScheduledAt.HasValue)
        {
            if (appointment.Status != Domain.Enums.AppointmentStatus.Scheduled)
            {
                throw new Exceptions.InvalidOperationException("Cannot reschedule an appointment that is not in 'Scheduled' status.");
            }
            // TODO: Add rescheduling window validation if needed
            appointment.ScheduledAt = request.ScheduledAt.Value;
        }

        if (request.DurationMinutes.HasValue)
            appointment.DurationMinutes = request.DurationMinutes.Value;

        if (request.Reason != null)
            appointment.Reason = request.Reason;

        appointment.UpdatedAt = DateTime.UtcNow;
        _context.Update(appointment);
        await _context.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureCanModifyAppointmentAsync(
        Appointment appointment,
        Guid userId,
        string role,
        CancellationToken cancellationToken)
    {
        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
            return;

        if (IsDoctorLikeRole(role))
        {
            var doctor = await _context.Set<Doctor>()
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.UserId == userId, cancellationToken);

            if (doctor is null || appointment.DoctorId != doctor.Id)
                throw new ForbiddenException("Solo puede actualizar sus propias citas.");

            return;
        }

        throw new ForbiddenException("No tiene permiso para actualizar citas.");
    }

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}
