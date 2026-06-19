using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.VitalSigns;

public static class PatientAlertThresholdAccessResolver
{
    public static async Task<Guid> ResolvePatientIdForThresholdWriteAsync(
        IApplicationDbContext context,
        ICurrentUserService currentUser,
        Guid? patientIdFromRequest,
        CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId
                     ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = currentUser.Role ?? string.Empty;

        if (string.Equals(role, "Patient", StringComparison.OrdinalIgnoreCase))
        {
            var selfId = await context.Set<Patient>()
                .AsNoTracking()
                .Where(p => p.UserId == userId)
                .Select(p => (Guid?)p.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!selfId.HasValue)
                throw new NotFoundException("Paciente", "perfil");

            if (patientIdFromRequest.HasValue && patientIdFromRequest.Value != selfId.Value)
                throw new ForbiddenException("Solo puede configurar sus propios umbrales.");

            return selfId.Value;
        }

        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            if (!patientIdFromRequest.HasValue)
                throw new ForbiddenException("Admin debe indicar patientId.");

            var exists = await context.Set<Patient>()
                .AsNoTracking()
                .AnyAsync(p => p.Id == patientIdFromRequest.Value, cancellationToken);

            if (!exists)
                throw new NotFoundException("Paciente", patientIdFromRequest.Value);

            return patientIdFromRequest.Value;
        }

        throw new ForbiddenException("Solo el paciente puede configurar umbrales de alerta.");
    }
}
