using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.Prescriptions;

public class CreatePrescriptionCommandHandler : IRequestHandler<CreatePrescriptionCommand, Guid>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public CreatePrescriptionCommandHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<Guid> Handle(CreatePrescriptionCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId
                     ?? throw new UnauthorizedAccessException("Authenticated user not found.");
        var role = _currentUserService.Role ?? string.Empty;

        var encounter = await _context.Set<ClinicalEncounter>()
            .Include(e => e.Appointment)
            .FirstOrDefaultAsync(e => e.Id == request.EncounterId, cancellationToken);

        if (encounter is null)
            throw new NotFoundException("Encuentro clínico", request.EncounterId);

        await EnsureCanCreatePrescriptionAsync(encounter, userId, role, cancellationToken);

        var now = DateTime.UtcNow;
        var prescriptionNumber = await GenerateUniquePrescriptionNumberAsync(cancellationToken);

        var prescription = new Prescription
        {
            Id = Guid.NewGuid(),
            EncounterId = encounter.Id,
            DoctorId = encounter.Appointment.DoctorId,
            PatientId = encounter.Appointment.PatientId,
            PrescriptionNumber = prescriptionNumber,
            IssuedAt = request.IssuedAt,
            ValidUntil = request.ValidUntil,
            DoctorSignatureHash = request.DoctorSignatureHash,
            CreatedAt = now,
            UpdatedAt = now
        };

        var medicationByNormalizedName = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);

        foreach (var line in request.Lines)
        {
            var medicationId = await ResolveMedicationIdAsync(
                line,
                medicationByNormalizedName,
                now,
                cancellationToken);

            prescription.Medications.Add(new PrescriptionMedication
            {
                PrescriptionId = prescription.Id,
                MedicationId = medicationId,
                Dosage = line.Dosage.Trim(),
                Frequency = line.Frequency.Trim(),
                DurationDays = line.DurationDays,
                Instructions = string.IsNullOrWhiteSpace(line.Instructions) ? null : line.Instructions.Trim(),
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        _context.Add(prescription);
        await _context.SaveChangesAsync(cancellationToken);
        return prescription.Id;
    }

    private async Task EnsureCanCreatePrescriptionAsync(
        ClinicalEncounter encounter,
        Guid userId,
        string role,
        CancellationToken cancellationToken)
    {
        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
            return;

        if (IsDoctorLikeRole(role))
        {
            var doctor = await _context.Set<Doctor>()
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.UserId == userId, cancellationToken);

            if (doctor is null || encounter.Appointment.DoctorId != doctor.Id)
                throw new ForbiddenException("Solo el médico asignado puede crear recetas para este encuentro.");

            return;
        }

        throw new ForbiddenException("No tiene permiso para crear recetas.");
    }

    private async Task<Guid> ResolveMedicationIdAsync(
        CreatePrescriptionLineItem line,
        Dictionary<string, Guid> medicationByNormalizedName,
        DateTime now,
        CancellationToken cancellationToken)
    {
        if (line.MedicationId.HasValue)
        {
            var exists = await _context.Set<Medication>()
                .AnyAsync(m => m.Id == line.MedicationId.Value, cancellationToken);
            if (!exists)
                throw new NotFoundException("Medicamento", line.MedicationId!.Value);

            return line.MedicationId.Value;
        }

        var name = line.MedicationName!.Trim();
        var key = name.ToLowerInvariant();

        if (medicationByNormalizedName.TryGetValue(key, out var cachedId))
            return cachedId;

        var existing = await _context.Set<Medication>()
            .FirstOrDefaultAsync(m => m.Name.ToLower() == name.ToLower(), cancellationToken);

        if (existing is not null)
        {
            medicationByNormalizedName[key] = existing.Id;
            return existing.Id;
        }

        var medication = new Medication
        {
            Id = Guid.NewGuid(),
            Name = name,
            CreatedAt = now,
            UpdatedAt = now
        };
        _context.Add(medication);
        medicationByNormalizedName[key] = medication.Id;
        return medication.Id;
    }

    private async Task<string> GenerateUniquePrescriptionNumberAsync(CancellationToken cancellationToken)
    {
        for (var i = 0; i < 5; i++)
        {
            var candidate = $"RX-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}";
            var taken = await _context.Set<Prescription>()
                .AnyAsync(p => p.PrescriptionNumber == candidate, cancellationToken);
            if (!taken)
                return candidate;
        }

        return $"RX-{Guid.NewGuid():N}";
    }

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}
