using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.VideoSessions;

public static class VideoSessionAccessHelper
{
    public static async Task<(Guid UserId, string Role)> ResolveCurrentUserAsync(
        ICurrentUserService currentUserService)
    {
        var userId = currentUserService.UserId
                     ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = currentUserService.Role ?? string.Empty;
        return await Task.FromResult((userId, role));
    }

    public static async Task EnsureCanCreateForAppointmentAsync(
        IApplicationDbContext context,
        Guid userId,
        string role,
        Appointment appointment,
        CancellationToken cancellationToken)
    {
        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
            return;

        if (IsDoctorLikeRole(role))
        {
            var doctorId = await context.Set<Doctor>()
                .Where(x => x.UserId == userId)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!doctorId.HasValue || doctorId.Value != appointment.DoctorId)
                throw new ForbiddenException("No tiene permiso para crear sesión para esta cita.");

            return;
        }

        throw new ForbiddenException("No tiene permiso para crear sesiones de videoconsulta.");
    }

    public static async Task EnsureCanAccessSessionAsync(
        IApplicationDbContext context,
        Guid userId,
        string role,
        VideoSession session,
        CancellationToken cancellationToken)
    {
        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
            return;

        if (string.Equals(role, "Patient", StringComparison.OrdinalIgnoreCase))
        {
            var selfPatientId = await context.Set<Patient>()
                .Where(x => x.UserId == userId)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!selfPatientId.HasValue || selfPatientId.Value != session.Appointment.PatientId)
                throw new ForbiddenException("No tiene permiso para acceder a esta sesión.");

            return;
        }

        if (IsDoctorLikeRole(role))
        {
            var doctorId = await context.Set<Doctor>()
                .Where(x => x.UserId == userId)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!doctorId.HasValue || doctorId.Value != session.Appointment.DoctorId)
                throw new ForbiddenException("No tiene permiso para acceder a esta sesión.");

            return;
        }

        throw new ForbiddenException("No tiene permiso para acceder a la sesión.");
    }

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}
