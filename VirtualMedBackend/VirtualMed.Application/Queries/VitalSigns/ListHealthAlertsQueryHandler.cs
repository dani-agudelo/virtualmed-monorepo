using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Common.Models;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.VitalSigns;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Queries.VitalSigns;

public class ListHealthAlertsQueryHandler : IRequestHandler<ListHealthAlertsQuery, PagedResult<HealthAlertDto>>
{
    private const int MaxPageSize = 100;

    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public ListHealthAlertsQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<PagedResult<HealthAlertDto>> Handle(
        ListHealthAlertsQuery request,
        CancellationToken cancellationToken)
    {
        var patientId = await PatientVitalAccessResolver.ResolvePatientIdForReadAsync(
            _context,
            _currentUser,
            request.PatientId,
            cancellationToken);

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? 50 : Math.Min(request.PageSize, MaxPageSize);

        var query = _context.Set<HealthAlert>()
            .AsNoTracking()
            .Where(a => a.PatientId == patientId);

        if (request.UnreadOnly == true)
            query = query.Where(a => !a.IsRead);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(a => a.OccurredAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new HealthAlertDto
            {
                Id = a.Id,
                PatientId = a.PatientId,
                VitalSignReadingId = a.VitalSignReadingId,
                AlertType = a.AlertType,
                Message = a.Message,
                Severity = a.Severity,
                IsRead = a.IsRead,
                OccurredAt = a.OccurredAt
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<HealthAlertDto>(items, page, pageSize, totalCount);
    }
}
