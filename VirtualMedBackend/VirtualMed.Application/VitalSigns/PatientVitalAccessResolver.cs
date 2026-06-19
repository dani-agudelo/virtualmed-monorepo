using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.VitalSigns;

public static class PatientVitalAccessResolver
{
    public static async Task<Guid> ResolvePatientIdForReadAsync(
        IApplicationDbContext context,
        ICurrentUserService currentUser,
        Guid? patientIdFromRequest,
        CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId
                     ?? throw new UnauthorizedAccessException("Usuario autenticado no encontrado.");
        var role = currentUser.Role ?? string.Empty;

        if (string.Equals(role, "Patient", StringComparison.OrdinalIgnoreCase))
        {
            var selfId = await GetSelfPatientIdAsync(context, userId, cancellationToken);
            if (!patientIdFromRequest.HasValue)
                return selfId;

            if (patientIdFromRequest.Value != selfId)
                throw new ForbiddenException("No tiene permiso para ver signos vitales de otro paciente.");

            return selfId;
        }

        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)
            || IsDoctorLikeRole(role))
        {
            if (!patientIdFromRequest.HasValue)
                throw new ForbiddenException("Debe indicar patientId para consultar signos vitales.");

            await EnsurePatientExistsAsync(context, patientIdFromRequest.Value, cancellationToken);
            if (IsDoctorLikeRole(role))
                await EnsureDoctorHasAttendedPatientAsync(context, userId, patientIdFromRequest.Value, cancellationToken);

            return patientIdFromRequest.Value;
        }

        if (string.Equals(role, "FamilyMember", StringComparison.OrdinalIgnoreCase))
        {
            if (!patientIdFromRequest.HasValue)
                throw new ForbiddenException("Debe indicar patientId.");

            await EnsurePatientExistsAsync(context, patientIdFromRequest.Value, cancellationToken);
            return patientIdFromRequest.Value;
        }

        throw new ForbiddenException("No tiene permiso para acceder a signos vitales.");
    }

    public static async Task<Guid> ResolvePatientIdForWriteAsync(
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
            var selfId = await GetSelfPatientIdAsync(context, userId, cancellationToken);
            if (patientIdFromRequest.HasValue && patientIdFromRequest.Value != selfId)
                throw new ForbiddenException("Solo puede registrar signos vitales propios.");

            return selfId;
        }

        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            if (!patientIdFromRequest.HasValue)
                throw new ForbiddenException("Debe indicar patientId al registrar en nombre de un paciente.");

            await EnsurePatientExistsAsync(context, patientIdFromRequest.Value, cancellationToken);
            return patientIdFromRequest.Value;
        }

        if (IsDoctorLikeRole(role))
        {
            if (!patientIdFromRequest.HasValue)
                throw new ForbiddenException("Debe indicar patientId al registrar signos vitales del paciente.");

            await EnsurePatientExistsAsync(context, patientIdFromRequest.Value, cancellationToken);
            await EnsureDoctorHasAttendedPatientAsync(context, userId, patientIdFromRequest.Value, cancellationToken);
            return patientIdFromRequest.Value;
        }

        throw new ForbiddenException("No tiene permiso para registrar signos vitales.");
    }

    private static async Task<Guid> GetSelfPatientIdAsync(
        IApplicationDbContext context,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var selfId = await context.Set<Patient>()
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => (Guid?)p.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (!selfId.HasValue)
            throw new NotFoundException("Paciente", "perfil");

        return selfId.Value;
    }

    private static async Task EnsurePatientExistsAsync(
        IApplicationDbContext context,
        Guid patientId,
        CancellationToken cancellationToken)
    {
        var exists = await context.Set<Patient>()
            .AsNoTracking()
            .AnyAsync(p => p.Id == patientId, cancellationToken);

        if (!exists)
            throw new NotFoundException("Paciente", patientId);
    }

    private static async Task EnsureDoctorHasAttendedPatientAsync(
        IApplicationDbContext context,
        Guid userId,
        Guid patientId,
        CancellationToken cancellationToken)
    {
        var doctorId = await context.Set<Doctor>()
            .AsNoTracking()
            .Where(d => d.UserId == userId)
            .Select(d => (Guid?)d.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (!doctorId.HasValue)
            throw new ForbiddenException("Solo los usuarios con perfil médico pueden registrar signos vitales de pacientes.");

        var hasAttended = await context.Set<ClinicalEncounter>()
            .AsNoTracking()
            .AnyAsync(
                e => e.Appointment.PatientId == patientId && e.Appointment.DoctorId == doctorId.Value,
                cancellationToken);

        if (!hasAttended)
            throw new ForbiddenException("Solo puede registrar signos vitales de pacientes que haya atendido.");
    }

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}
