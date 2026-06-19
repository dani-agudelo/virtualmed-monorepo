using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Queries.Appointments;

public class GetAppointmentByIdQueryHandler : IRequestHandler<GetAppointmentByIdQuery, AppointmentDto?>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public GetAppointmentByIdQueryHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<AppointmentDto?> Handle(GetAppointmentByIdQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId
                     ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = _currentUserService.Role ?? string.Empty;

        var appointment = await _context.Set<Appointment>()
            .AsNoTracking()
            .Include(a => a.Patient).ThenInclude(p => p.User)
            .Include(a => a.Doctor).ThenInclude(d => d.User)
            .Include(a => a.ClinicalEncounter)
            .Include(a => a.VideoSessions)
            .FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);

        if (appointment is null)
            return null;

        await EnsureCanReadAsync(appointment, userId, role, cancellationToken);

        return ToDto(appointment);
    }

    private async Task EnsureCanReadAsync(
        Appointment appointment,
        Guid userId,
        string role,
        CancellationToken cancellationToken)
    {
        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
            return;

        if (string.Equals(role, "Patient", StringComparison.OrdinalIgnoreCase))
        {
            var selfPatientId = await _context.Set<Patient>()
                .Where(x => x.UserId == userId)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!selfPatientId.HasValue || selfPatientId.Value != appointment.PatientId)
                throw new ForbiddenException("No tiene permiso para ver esta cita.");

            return;
        }

        if (IsDoctorLikeRole(role))
        {
            var doctor = await _context.Set<Doctor>()
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.UserId == userId, cancellationToken);

            if (doctor is null || appointment.DoctorId != doctor.Id)
                throw new ForbiddenException("No tiene permiso para ver esta cita.");

            return;
        }

        throw new ForbiddenException("No tiene permiso para ver citas.");
    }

    private static AppointmentDto ToDto(Appointment a) =>
        new()
        {
            Id = a.Id,
            PatientId = a.PatientId,
            PatientFullName = a.Patient.User.FullName,
            DoctorId = a.DoctorId,
            DoctorFullName = a.Doctor.User.FullName,
            ScheduledAt = a.ScheduledAt,
            DurationMinutes = a.DurationMinutes,
            Status = a.Status,
            Reason = a.Reason,
            CreatedAt = a.CreatedAt,
            UpdatedAt = a.UpdatedAt,
            HasClinicalEncounter = a.ClinicalEncounter != null,
            VideoSessionId = a.VideoSessions
                .Where(v => v.Status != VideoSessionStatus.Ended)
                .OrderByDescending(v => v.CreatedAt)
                .Select(v => (Guid?)v.SessionId)
                .FirstOrDefault()
        };

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}
