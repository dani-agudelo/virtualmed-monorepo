using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Queries.Doctors;

public class GetMyDoctorAvailabilityQueryHandler : IRequestHandler<GetMyDoctorAvailabilityQuery, DoctorAvailabilityDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public GetMyDoctorAvailabilityQueryHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<DoctorAvailabilityDto> Handle(
        GetMyDoctorAvailabilityQuery request,
        CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId
                     ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = _currentUserService.Role ?? string.Empty;

        if (!IsDoctorLikeRole(role))
            throw new ForbiddenException("Solo Doctor o Specialist pueden usar este recurso sin indicar médico.");

        var doctor = await _context.Set<Doctor>()
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.UserId == userId, cancellationToken);

        if (doctor is null)
            throw new ForbiddenException("No se encontró perfil de médico para el usuario autenticado.");

        var (fromUtc, toUtc) = DoctorAvailabilityComputation.ValidateRangeAndParameters(
            request.FromUtc,
            request.ToUtc,
            request.SlotStepMinutes,
            request.AppointmentDurationMinutes);

        return await DoctorAvailabilityComputation.ComputeAsync(
            _context,
            doctor.Id,
            fromUtc,
            toUtc,
            request.SlotStepMinutes,
            request.AppointmentDurationMinutes,
            cancellationToken);
    }

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}
