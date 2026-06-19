using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Queries.Appointments;

public class ListAppointmentsQueryHandler : IRequestHandler<ListAppointmentsQuery, IReadOnlyCollection<AppointmentDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public ListAppointmentsQueryHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<IReadOnlyCollection<AppointmentDto>> Handle(
        ListAppointmentsQuery request,
        CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId
                     ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = _currentUserService.Role ?? string.Empty;

        var query = _context.Set<Appointment>()
            .AsNoTracking()
            .Include(a => a.ClinicalEncounter)
            .AsQueryable();

        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            if (request.PatientId.HasValue)
                query = query.Where(a => a.PatientId == request.PatientId.Value);
            if (request.DoctorId.HasValue)
                query = query.Where(a => a.DoctorId == request.DoctorId.Value);
        }
        else if (string.Equals(role, "Patient", StringComparison.OrdinalIgnoreCase))
        {
            var selfPatientId = await _context.Set<Patient>()
                .Where(x => x.UserId == userId)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!selfPatientId.HasValue)
                return Array.Empty<AppointmentDto>();

            query = query.Where(a => a.PatientId == selfPatientId.Value);
            if (request.PatientId.HasValue && request.PatientId.Value != selfPatientId.Value)
                throw new ForbiddenException("Solo puede listar sus propias citas.");
        }
        else if (IsDoctorLikeRole(role))
        {
            var doctor = await _context.Set<Doctor>()
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.UserId == userId, cancellationToken);

            if (doctor is null)
                return Array.Empty<AppointmentDto>();

            query = query.Where(a => a.DoctorId == doctor.Id);
            if (request.DoctorId.HasValue && request.DoctorId.Value != doctor.Id)
                throw new ForbiddenException("Solo puede listar sus propias citas.");
        }
        else if (string.Equals(role, "FamilyMember", StringComparison.OrdinalIgnoreCase))
        {
            // ER: acceso vía AccessAuthorization (pendiente). Sin modelo aún → lista vacía.
            return Array.Empty<AppointmentDto>();
        }
        else
            throw new ForbiddenException("No tiene permiso para listar citas.");

        if (request.From.HasValue)
            query = query.Where(a => a.ScheduledAt >= request.From.Value);

        if (request.To.HasValue)
            query = query.Where(a => a.ScheduledAt <= request.To.Value);

        var list = await query
            .OrderBy(a => a.ScheduledAt)
            .Select(a => new AppointmentDto
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
            })
            .ToListAsync(cancellationToken);

        return list;
    }

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}
