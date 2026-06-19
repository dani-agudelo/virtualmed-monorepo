using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.VideoSessions;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Queries.VideoSessions;

public class ListMyVideoSessionsQueryHandler
    : IRequestHandler<ListMyVideoSessionsQuery, IReadOnlyCollection<VideoSessionDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public ListMyVideoSessionsQueryHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<IReadOnlyCollection<VideoSessionDto>> Handle(
        ListMyVideoSessionsQuery request,
        CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId
                     ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = _currentUserService.Role ?? string.Empty;

        IQueryable<VideoSession> query = _context.Set<VideoSession>()
            .AsNoTracking()
            .Include(v => v.Appointment);

        if (IsDoctorLikeRole(role))
        {
            var doctor = await _context.Set<Doctor>()
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.UserId == userId, cancellationToken);

            if (doctor is null)
                return Array.Empty<VideoSessionDto>();

            query = query.Where(v => v.Appointment.DoctorId == doctor.Id);
        }
        else if (string.Equals(role, "Patient", StringComparison.OrdinalIgnoreCase))
        {
            var selfPatientId = await _context.Set<Patient>()
                .AsNoTracking()
                .Where(x => x.UserId == userId)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!selfPatientId.HasValue)
                return Array.Empty<VideoSessionDto>();

            query = query.Where(v => v.Appointment.PatientId == selfPatientId.Value);
        }
        else
            throw new ForbiddenException(
                "Solo paciente, médico o especialista pueden listar sus sesiones de videoconsulta.");

        if (!request.IncludeEnded)
            query = query.Where(v => v.Status != VideoSessionStatus.Ended);

        var sessions = await query
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync(cancellationToken);

        return sessions.Select(VideoSessionMapper.ToDto).ToList();
    }

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}
