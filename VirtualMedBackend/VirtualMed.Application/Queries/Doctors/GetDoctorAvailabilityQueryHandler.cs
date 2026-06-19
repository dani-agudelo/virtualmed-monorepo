using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Queries.Doctors;

public class GetDoctorAvailabilityQueryHandler : IRequestHandler<GetDoctorAvailabilityQuery, DoctorAvailabilityDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public GetDoctorAvailabilityQueryHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<DoctorAvailabilityDto> Handle(
        GetDoctorAvailabilityQuery request,
        CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId
                     ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = _currentUserService.Role ?? string.Empty;

        var (fromUtc, toUtc) = DoctorAvailabilityComputation.ValidateRangeAndParameters(
            request.FromUtc,
            request.ToUtc,
            request.SlotStepMinutes,
            request.AppointmentDurationMinutes);

        await EnsureCanViewDoctorAvailabilityAsync(userId, role, request.DoctorId, cancellationToken);

        return await DoctorAvailabilityComputation.ComputeAsync(
            _context,
            request.DoctorId,
            fromUtc,
            toUtc,
            request.SlotStepMinutes,
            request.AppointmentDurationMinutes,
            cancellationToken);
    }

    private async Task EnsureCanViewDoctorAvailabilityAsync(
        Guid userId,
        string role,
        Guid doctorId,
        CancellationToken cancellationToken)
    {
        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
            return;

        if (IsDoctorLikeRole(role))
        {
            var self = await _context.Set<Doctor>()
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.UserId == userId, cancellationToken);

            if (self is null)
                throw new ForbiddenException("Solo los usuarios con perfil médico pueden consultar disponibilidad.");

            if (self.Id != doctorId)
                throw new ForbiddenException("No puede consultar la disponibilidad de otro médico.");

            return;
        }

        throw new ForbiddenException("No tiene permiso para consultar disponibilidad.");
    }

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}
