using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.VitalSigns;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Queries.VitalSigns;

public class ListAlertThresholdsQueryHandler : IRequestHandler<ListAlertThresholdsQuery, IReadOnlyList<AlertThresholdDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public ListAlertThresholdsQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<AlertThresholdDto>> Handle(
        ListAlertThresholdsQuery request,
        CancellationToken cancellationToken)
    {
        var patientId = await PatientVitalAccessResolver.ResolvePatientIdForReadAsync(
            _context,
            _currentUser,
            request.PatientId,
            cancellationToken);

        return await _context.Set<AlertThreshold>()
            .AsNoTracking()
            .Where(t => t.PatientId == patientId)
            .OrderBy(t => t.VitalSignType)
            .Select(t => new AlertThresholdDto
            {
                Id = t.Id,
                PatientId = t.PatientId,
                VitalSignType = t.VitalSignType,
                MinValue = t.MinValue,
                MaxValue = t.MaxValue,
                IsActive = t.IsActive,
                AlertLevel = t.AlertLevel,
                UpdatedAt = t.UpdatedAt
            })
            .ToListAsync(cancellationToken);
    }
}
