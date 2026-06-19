using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.VitalSigns;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.VitalSigns;

public class SetAlertThresholdCommandHandler : IRequestHandler<SetAlertThresholdCommand, Guid>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public SetAlertThresholdCommandHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<Guid> Handle(SetAlertThresholdCommand request, CancellationToken cancellationToken)
    {
        if (request.MinValue >= request.MaxValue)
            throw new BusinessRuleException("THRESHOLD_INVALID_RANGE", "MinValue debe ser menor que MaxValue.");

        var patientId = await PatientAlertThresholdAccessResolver.ResolvePatientIdForThresholdWriteAsync(
            _context,
            _currentUser,
            request.PatientId,
            cancellationToken);

        var now = DateTime.UtcNow;
        AlertThreshold entity;

        if (request.Id.HasValue)
        {
            entity = await _context.Set<AlertThreshold>()
                .FirstOrDefaultAsync(t => t.Id == request.Id.Value && t.PatientId == patientId, cancellationToken)
                ?? throw new Exceptions.NotFoundException("Umbral", request.Id.Value);

            entity.MinValue = request.MinValue;
            entity.MaxValue = request.MaxValue;
            entity.IsActive = request.IsActive;
            entity.AlertLevel = request.AlertLevel;
            entity.UpdatedAt = now;
            _context.Update(entity);
        }
        else
        {
            var existing = await _context.Set<AlertThreshold>()
                .FirstOrDefaultAsync(
                    t => t.PatientId == patientId && t.VitalSignType == request.VitalSignType,
                    cancellationToken);

            if (existing is not null)
            {
                existing.MinValue = request.MinValue;
                existing.MaxValue = request.MaxValue;
                existing.IsActive = request.IsActive;
                existing.AlertLevel = request.AlertLevel;
                existing.UpdatedAt = now;
                _context.Update(existing);
                await _context.SaveChangesAsync(cancellationToken);
                return existing.Id;
            }

            entity = new AlertThreshold
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                VitalSignType = request.VitalSignType,
                MinValue = request.MinValue,
                MaxValue = request.MaxValue,
                IsActive = request.IsActive,
                AlertLevel = request.AlertLevel,
                UpdatedAt = now
            };
            _context.Add(entity);
        }

        await _context.SaveChangesAsync(cancellationToken);
        return entity.Id;
    }
}
