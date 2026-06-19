using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Queries.Prescriptions;

public class GetPrescriptionByIdQueryHandler : IRequestHandler<GetPrescriptionByIdQuery, PrescriptionDetailDto?>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public GetPrescriptionByIdQueryHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<PrescriptionDetailDto?> Handle(GetPrescriptionByIdQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId
                     ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = _currentUserService.Role ?? string.Empty;

        var prescription = await _context.Set<Prescription>()
            .AsNoTracking()
            .Include(p => p.Medications)
            .ThenInclude(m => m.Medication)
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        if (prescription is null)
            return null;

        await EnsureCanReadPrescriptionAsync(prescription, userId, role, cancellationToken);

        return new PrescriptionDetailDto
        {
            Id = prescription.Id,
            EncounterId = prescription.EncounterId,
            DoctorId = prescription.DoctorId,
            PatientId = prescription.PatientId,
            PrescriptionNumber = prescription.PrescriptionNumber,
            IssuedAt = prescription.IssuedAt,
            ValidUntil = prescription.ValidUntil,
            DoctorSignatureHash = prescription.DoctorSignatureHash,
            Medications = prescription.Medications.Select(pm => new PrescriptionMedicationLineDto
            {
                MedicationId = pm.MedicationId,
                MedicationName = pm.Medication.Name,
                Dosage = pm.Dosage,
                Frequency = pm.Frequency,
                DurationDays = pm.DurationDays,
                Instructions = pm.Instructions
            }).ToList()
        };
    }

    private async Task EnsureCanReadPrescriptionAsync(
        Prescription prescription,
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

            if (!selfPatientId.HasValue || selfPatientId.Value != prescription.PatientId)
                throw new ForbiddenException("No tiene permiso para ver esta receta.");

            return;
        }

        if (IsDoctorLikeRole(role))
        {
            var doctor = await _context.Set<Doctor>()
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.UserId == userId, cancellationToken);

            if (doctor is null || prescription.DoctorId != doctor.Id)
                throw new ForbiddenException("No tiene permiso para ver esta receta.");

            return;
        }

        throw new ForbiddenException("No tiene permiso para ver recetas.");
    }

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}
