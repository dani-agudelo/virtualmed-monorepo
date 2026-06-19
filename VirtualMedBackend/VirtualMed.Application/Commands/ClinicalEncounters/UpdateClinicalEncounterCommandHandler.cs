using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.ClinicalEncounters;

public class UpdateClinicalEncounterCommandHandler : IRequestHandler<UpdateClinicalEncounterCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public UpdateClinicalEncounterCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task Handle(UpdateClinicalEncounterCommand request, CancellationToken cancellationToken)
    {
        _ = _currentUserService.UserId
            ?? throw new UnauthorizedAccessException("Authenticated user not found.");

        var role = _currentUserService.Role ?? string.Empty;
        var isAdmin = string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);
        var isDoctorLike = IsDoctorLikeRole(role);

        if (!isAdmin && !isDoctorLike)
            throw new ForbiddenException("No tiene permiso para actualizar encuentros clínicos.");

        var encounter = await _context.Set<ClinicalEncounter>()
            .Include(e => e.Appointment)
            .Include(e => e.Diagnoses)
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        if (encounter is null)
            throw new NotFoundException("Encuentro clínico", request.Id);

        if (isDoctorLike && !isAdmin)
        {
            var doctorId = await _context.Set<Doctor>()
                .Where(x => x.UserId == _currentUserService.UserId)
                .Select(x => (Guid?)x.Id)
                .FirstOrDefaultAsync(cancellationToken);

            if (!doctorId.HasValue)
                throw new ForbiddenException("Solo los usuarios con perfil médico pueden actualizar encuentros.");

            if (encounter.Appointment.DoctorId != doctorId.Value)
                throw new ForbiddenException("Solo el médico asignado a la cita puede editar este encuentro.");

            if (encounter.IsLocked)
                throw new ForbiddenException("El encuentro está bloqueado y no admite ediciones.");

            var deadline = encounter.CreatedAt.AddHours(24);
            if (DateTime.UtcNow > deadline)
            {
                encounter.IsLocked = true;
                encounter.UpdatedAt = DateTime.UtcNow;
                _context.Update(encounter);
                await _context.SaveChangesAsync(cancellationToken);
                throw new BusinessRuleException(
                    "El plazo de edición de 24 horas ha expirado. El encuentro ha quedado bloqueado.");
            }

            ApplyFieldUpdates(_context, encounter, request, applyIsLockedFromRequest: false);
        }
        else
        {
            ApplyFieldUpdates(_context, encounter, request, applyIsLockedFromRequest: true);
        }

        if (encounter.EndAt.HasValue && encounter.EndAt.Value < encounter.StartAt)
            throw new BusinessRuleException("EndAt no puede ser anterior a StartAt.");

        encounter.UpdatedAt = DateTime.UtcNow;
        _context.Update(encounter);
        await _context.SaveChangesAsync(cancellationToken);
    }

    private static void ApplyFieldUpdates(
        IApplicationDbContext context,
        ClinicalEncounter encounter,
        UpdateClinicalEncounterCommand request,
        bool applyIsLockedFromRequest)
    {
        if (request.EncounterType.HasValue)
            encounter.EncounterType = request.EncounterType.Value;

        if (request.StartAt.HasValue)
            encounter.StartAt = request.StartAt.Value;

        if (request.EndAt.HasValue)
            encounter.EndAt = request.EndAt;

        if (request.ChiefComplaint is not null)
            encounter.ChiefComplaint = request.ChiefComplaint;

        if (request.CurrentCondition is not null)
            encounter.CurrentCondition = request.CurrentCondition;

        if (request.PhysicalExam is not null)
            encounter.PhysicalExam = request.PhysicalExam;

        if (request.Assessment is not null)
            encounter.Assessment = request.Assessment;

        if (request.Plan is not null)
            encounter.Plan = request.Plan;

        if (request.Notes is not null)
            encounter.Notes = request.Notes;

        if (request.RecordingUrl is not null)
            encounter.RecordingUrl = request.RecordingUrl;

        if (applyIsLockedFromRequest && request.IsLocked.HasValue)
            encounter.IsLocked = request.IsLocked.Value;

        if (request.Diagnoses is not null)
        {
            foreach (var existing in encounter.Diagnoses.ToList())
            {
                encounter.Diagnoses.Remove(existing);
                context.Remove(existing);
            }

            var now = DateTime.UtcNow;
            foreach (var d in request.Diagnoses)
            {
                encounter.Diagnoses.Add(new Diagnosis
                {
                    Id = Guid.NewGuid(),
                    EncounterId = encounter.Id,
                    Icd10Code = d.Icd10Code.Trim().ToUpperInvariant(),
                    Description = d.Description.Trim(),
                    Type = d.Type,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
        }
    }

    private static bool IsDoctorLikeRole(string role) =>
        string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Specialist", StringComparison.OrdinalIgnoreCase);
}
