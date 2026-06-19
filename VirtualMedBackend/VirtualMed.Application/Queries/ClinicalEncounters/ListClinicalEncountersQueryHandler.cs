using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Queries.ClinicalEncounters;

public class ListClinicalEncountersQueryHandler : IRequestHandler<ListClinicalEncountersQuery, IReadOnlyCollection<ClinicalEncounterListItemDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public ListClinicalEncountersQueryHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<IReadOnlyCollection<ClinicalEncounterListItemDto>> Handle(
        ListClinicalEncountersQuery request,
        CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId
                     ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = _currentUserService.Role ?? string.Empty;

        IQueryable<ClinicalEncounter> query = _context.Set<ClinicalEncounter>()
            .AsNoTracking();

        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            if (request.PatientId.HasValue)
                query = query.Where(x => x.Appointment.PatientId == request.PatientId.Value);
            if (request.DoctorId.HasValue)
                query = query.Where(x => x.Appointment.DoctorId == request.DoctorId.Value);
        }
        else if (string.Equals(role, "Patient", StringComparison.OrdinalIgnoreCase))
        {
            var selfPatientId = await _context.Set<Patient>()
                .Where(x => x.UserId == userId)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!selfPatientId.HasValue)
                return Array.Empty<ClinicalEncounterListItemDto>();

            if (request.PatientId.HasValue && request.PatientId.Value != selfPatientId.Value)
                throw new ForbiddenException("Solo puede listar sus propios encuentros clínicos.");

            query = query.Where(x => x.Appointment.PatientId == selfPatientId.Value);

            if (request.DoctorId.HasValue)
                query = query.Where(x => x.Appointment.DoctorId == request.DoctorId.Value);
        }
        else if (IsDoctorLikeRole(role))
        {
            var doctorId = await _context.Set<Doctor>()
                .Where(x => x.UserId == userId)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!doctorId.HasValue)
                throw new ForbiddenException("Solo los usuarios con perfil médico pueden listar encuentros clínicos.");

            if (request.DoctorId.HasValue && request.DoctorId.Value != doctorId.Value)
                throw new ForbiddenException("Solo puede listar sus propios encuentros clínicos.");

            query = query.Where(x => x.Appointment.DoctorId == doctorId.Value);

            if (request.PatientId.HasValue)
            {
                var hasAttendedPatient = await _context.Set<ClinicalEncounter>()
                    .AnyAsync(
                        x => x.Appointment.PatientId == request.PatientId.Value && x.Appointment.DoctorId == doctorId.Value,
                        cancellationToken);

                if (!hasAttendedPatient)
                    throw new ForbiddenException("Solo puede acceder al historial de pacientes que haya atendido.");

                query = query.Where(x => x.Appointment.PatientId == request.PatientId.Value);
            }
        }
        else if (string.Equals(role, "FamilyMember", StringComparison.OrdinalIgnoreCase))
        {
            return Array.Empty<ClinicalEncounterListItemDto>();
        }
        else
            throw new ForbiddenException("No tiene permiso para listar encuentros clínicos.");

        if (request.From.HasValue)
            query = query.Where(x => x.StartAt >= request.From.Value);

        if (request.To.HasValue)
            query = query.Where(x => x.StartAt <= request.To.Value);

        if (request.EncounterType.HasValue)
            query = query.Where(x => x.EncounterType == request.EncounterType.Value);

        var data = await query
            .OrderByDescending(x => x.StartAt)
            .Select(x => new ClinicalEncounterListItemDto
            {
                Id = x.Id,
                AppointmentId = x.AppointmentId,
                PatientId = x.Appointment.PatientId,
                DoctorId = x.Appointment.DoctorId,
                EncounterType = x.EncounterType,
                StartAt = x.StartAt,
                EndAt = x.EndAt,
                ChiefComplaint = x.ChiefComplaint,
                Diagnoses = x.Diagnoses
                    .Select(d => new DiagnosisDto
                    {
                        Id = d.Id,
                        Icd10Code = d.Icd10Code,
                        Description = d.Description,
                        Type = d.Type
                    })
                    .ToList(),
                Prescriptions = x.Prescriptions
                    .Select(p => new PrescriptionDto
                    {
                        Id = p.Id,
                        PrescriptionNumber = p.PrescriptionNumber,
                        IssuedAt = p.IssuedAt,
                        ValidUntil = p.ValidUntil,
                        Medications = p.Medications
                            .Select(pm => new PrescriptionMedicationDto
                            {
                                MedicationId = pm.MedicationId,
                                MedicationName = pm.Medication.Name,
                                Dosage = pm.Dosage,
                                Frequency = pm.Frequency,
                                DurationDays = pm.DurationDays,
                                Instructions = pm.Instructions
                            })
                            .ToList()
                    })
                    .ToList()
            })
            .ToListAsync(cancellationToken);

        return data;
    }

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}
