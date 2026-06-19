using FluentValidation;
using FluentValidation.Results;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Patients;

internal static class PatientClinicalHistoryExportDataLoader
{
    public static async Task<Guid> ResolveTargetPatientIdForExportAsync(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        Guid? patientIdFromRequest,
        CancellationToken cancellationToken)
    {
        _ = currentUserService.UserId
            ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = currentUserService.Role ?? string.Empty;

        if (string.Equals(role, "Patient", StringComparison.OrdinalIgnoreCase))
        {
            var selfPatientId = await context.Set<Patient>()
                .Where(x => x.UserId == currentUserService.UserId)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!selfPatientId.HasValue)
                throw new NotFoundException("Paciente", "perfil");

            if (!patientIdFromRequest.HasValue)
                return selfPatientId.Value;

            if (patientIdFromRequest.Value != selfPatientId.Value)
                throw new ForbiddenException("No tiene permiso para acceder al historial de este paciente.");

            return selfPatientId.Value;
        }

        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)
            || IsDoctorLikeRole(role))
        {
            if (!patientIdFromRequest.HasValue)
            {
                throw new ValidationException([
                    new ValidationFailure(
                        "patientId",
                        "El parámetro patientId es obligatorio para exportar el historial con este rol.")
                ]);
            }

            return patientIdFromRequest.Value;
        }

        throw new ForbiddenException("No tiene permiso para acceder al historial del paciente.");
    }

    public static async Task<(Patient Patient, List<ClinicalEncounter> Encounters)> LoadAuthorizedAsync(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        Guid patientId,
        CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId
                     ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = currentUserService.Role ?? string.Empty;

        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            // Sin restricción adicional.
        }
        else if (string.Equals(role, "Patient", StringComparison.OrdinalIgnoreCase))
        {
            var selfPatientId = await context.Set<Patient>()
                .Where(x => x.UserId == userId)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!selfPatientId.HasValue || selfPatientId.Value != patientId)
                throw new ForbiddenException("No tiene permiso para acceder al historial de este paciente.");
        }
        else if (IsDoctorLikeRole(role))
        {
            var doctorId = await context.Set<Doctor>()
                .Where(x => x.UserId == userId)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!doctorId.HasValue)
                throw new ForbiddenException("Solo los usuarios con perfil médico pueden acceder a este historial.");

            var hasAttendedPatient = await context.Set<ClinicalEncounter>()
                .AnyAsync(
                    x => x.Appointment.PatientId == patientId && x.Appointment.DoctorId == doctorId.Value,
                    cancellationToken);

            if (!hasAttendedPatient)
                throw new ForbiddenException("Solo puede acceder al historial de pacientes que haya atendido.");
        }
        else
            throw new ForbiddenException("No tiene permiso para acceder al historial del paciente.");

        var patient = await context.Set<Patient>()
            .AsNoTracking()
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == patientId, cancellationToken);

        if (patient is null)
            throw new NotFoundException("Paciente", patientId);

        var encounters = await context.Set<ClinicalEncounter>()
            .AsNoTracking()
            .Where(e => e.Appointment.PatientId == patientId)
            .Include(e => e.Appointment)
            .ThenInclude(a => a.Doctor)
            .ThenInclude(d => d.User)
            .Include(e => e.Diagnoses)
            .Include(e => e.Prescriptions)
            .ThenInclude(p => p.Medications)
            .ThenInclude(m => m.Medication)
            .OrderBy(e => e.StartAt)
            .ToListAsync(cancellationToken);

        return (patient, encounters);
    }

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}
