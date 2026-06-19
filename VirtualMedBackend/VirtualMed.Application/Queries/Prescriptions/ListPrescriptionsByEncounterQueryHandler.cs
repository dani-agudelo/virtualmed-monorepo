using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Queries.Prescriptions;

public class ListPrescriptionsByEncounterQueryHandler
    : IRequestHandler<ListPrescriptionsByEncounterQuery, IReadOnlyCollection<PrescriptionDetailDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public ListPrescriptionsByEncounterQueryHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<IReadOnlyCollection<PrescriptionDetailDto>> Handle(
        ListPrescriptionsByEncounterQuery request,
        CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId
                     ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = _currentUserService.Role ?? string.Empty;

        var encounter = await _context.Set<ClinicalEncounter>()
            .AsNoTracking()
            .Include(e => e.Appointment)
            .FirstOrDefaultAsync(e => e.Id == request.EncounterId, cancellationToken);

        if (encounter is null)
            throw new NotFoundException("Encuentro clínico", request.EncounterId);

        await EnsureCanReadEncounterPrescriptionsAsync(encounter, userId, role, cancellationToken);

        var prescriptions = await _context.Set<Prescription>()
            .AsNoTracking()
            .Where(p => p.EncounterId == request.EncounterId)
            .Include(p => p.Medications)
            .ThenInclude(m => m.Medication)
            .OrderByDescending(p => p.IssuedAt)
            .ToListAsync(cancellationToken);

        return prescriptions.Select(p => new PrescriptionDetailDto
        {
            Id = p.Id,
            EncounterId = p.EncounterId,
            DoctorId = p.DoctorId,
            PatientId = p.PatientId,
            PrescriptionNumber = p.PrescriptionNumber,
            IssuedAt = p.IssuedAt,
            ValidUntil = p.ValidUntil,
            DoctorSignatureHash = p.DoctorSignatureHash,
            Medications = p.Medications.Select(pm => new PrescriptionMedicationLineDto
            {
                MedicationId = pm.MedicationId,
                MedicationName = pm.Medication.Name,
                Dosage = pm.Dosage,
                Frequency = pm.Frequency,
                DurationDays = pm.DurationDays,
                Instructions = pm.Instructions
            }).ToList()
        }).ToList();
    }

    private async Task EnsureCanReadEncounterPrescriptionsAsync(
        ClinicalEncounter encounter,
        Guid userId,
        string role,
        CancellationToken cancellationToken)
    {
        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
            return;

        if (string.Equals(role, "Patient", StringComparison.OrdinalIgnoreCase))
        {
            var selfPatientId = await _context.Set<Patient>()
                .Where(x => x.UserId == userId)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!selfPatientId.HasValue || selfPatientId.Value != encounter.Appointment.PatientId)
                throw new ForbiddenException("No tiene permiso para ver las recetas de este encuentro.");

            return;
        }

        if (IsDoctorLikeRole(role))
        {
            var doctor = await _context.Set<Doctor>()
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.UserId == userId, cancellationToken);

            if (doctor is null || encounter.Appointment.DoctorId != doctor.Id)
                throw new ForbiddenException("No tiene permiso para ver las recetas de este encuentro.");

            return;
        }

        throw new ForbiddenException("No tiene permiso para ver recetas.");
    }

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}
