using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Queries.ClinicalEncounters;

public class GetClinicalEncounterByIdQueryHandler : IRequestHandler<GetClinicalEncounterByIdQuery, ClinicalEncounterDetailDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public GetClinicalEncounterByIdQueryHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<ClinicalEncounterDetailDto> Handle(GetClinicalEncounterByIdQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId
                     ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = _currentUserService.Role ?? string.Empty;

        if (!string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(role, "Patient", StringComparison.OrdinalIgnoreCase)
            && !IsDoctorLikeRole(role))
            throw new ForbiddenException("No tiene permiso para acceder a este encuentro clínico.");

        var encounter = await _context.Set<ClinicalEncounter>()
            .AsNoTracking()
            .Include(x => x.Appointment)
            .Include(x => x.Diagnoses)
            .Include(x => x.Prescriptions)
                .ThenInclude(x => x.Medications)
                .ThenInclude(x => x.Medication)
            .FirstOrDefaultAsync(x => x.Id == request.Id, cancellationToken);

        if (encounter is null)
            throw new NotFoundException("Encuentro clínico", request.Id);

        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            // Acceso completo.
        }
        else if (string.Equals(role, "Patient", StringComparison.OrdinalIgnoreCase))
        {
            var selfPatientId = await _context.Set<Patient>()
                .Where(x => x.UserId == userId)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!selfPatientId.HasValue || selfPatientId.Value != encounter.Appointment.PatientId)
                throw new ForbiddenException("No tiene permiso para acceder a este encuentro clínico.");
        }
        else if (IsDoctorLikeRole(role))
        {
            var doctorId = await _context.Set<Doctor>()
                .Where(x => x.UserId == userId)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!doctorId.HasValue)
                throw new ForbiddenException("Solo los usuarios con perfil médico pueden acceder a este encuentro.");

            var hasAttendedPatient = await _context.Set<ClinicalEncounter>()
                .AnyAsync(x => x.Appointment.PatientId == encounter.Appointment.PatientId && x.Appointment.DoctorId == doctorId.Value, cancellationToken);

            if (!hasAttendedPatient)
                throw new ForbiddenException("Solo puede acceder a registros de pacientes que haya atendido.");
        }

        return new ClinicalEncounterDetailDto
        {
            Id = encounter.Id,
            AppointmentId = encounter.AppointmentId,
            PatientId = encounter.Appointment.PatientId,
            DoctorId = encounter.Appointment.DoctorId,
            StartAt = encounter.StartAt,
            EndAt = encounter.EndAt,
            ChiefComplaint = encounter.ChiefComplaint,
            CurrentCondition = encounter.CurrentCondition,
            PhysicalExam = encounter.PhysicalExam,
            Assessment = encounter.Assessment,
            Plan = encounter.Plan,
            Notes = encounter.Notes,
            RecordingUrl = encounter.RecordingUrl,
            IsLocked = encounter.IsLocked,
            EncounterType = encounter.EncounterType,
            Diagnoses = encounter.Diagnoses.Select(d => new DiagnosisDto
            {
                Id = d.Id,
                Icd10Code = d.Icd10Code,
                Description = d.Description,
                Type = d.Type
            }).ToList(),
            Prescriptions = encounter.Prescriptions.Select(p => new PrescriptionDto
            {
                Id = p.Id,
                PrescriptionNumber = p.PrescriptionNumber,
                IssuedAt = p.IssuedAt,
                ValidUntil = p.ValidUntil,
                Medications = p.Medications.Select(pm => new PrescriptionMedicationDto
                {
                    MedicationId = pm.MedicationId,
                    MedicationName = pm.Medication.Name,
                    Dosage = pm.Dosage,
                    Frequency = pm.Frequency,
                    DurationDays = pm.DurationDays,
                    Instructions = pm.Instructions
                }).ToList()
            }).ToList()
        };
    }

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}

