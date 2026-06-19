using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Common.Models;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.VitalSigns;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Queries.VitalSigns;

public class ListVitalSignReadingsQueryHandler : IRequestHandler<ListVitalSignReadingsQuery, VitalSignReadingsListResult>
{
    private const int MaxPageSize = 100;

    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public ListVitalSignReadingsQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<VitalSignReadingsListResult> Handle(
        ListVitalSignReadingsQuery request,
        CancellationToken cancellationToken)
    {
        var patientId = await PatientVitalAccessResolver.ResolvePatientIdForReadAsync(
            _context,
            _currentUser,
            request.PatientId,
            cancellationToken);

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? 50 : Math.Min(request.PageSize, MaxPageSize);

        var query = _context.Set<VitalSignReading>()
            .AsNoTracking()
            .Where(r => r.PatientId == patientId);

        if (request.FromUtc.HasValue)
        {
            var from = DateTime.SpecifyKind(request.FromUtc.Value, DateTimeKind.Utc);
            query = query.Where(r => r.ReadingAt >= from);
        }

        if (request.ToUtc.HasValue)
        {
            var to = DateTime.SpecifyKind(request.ToUtc.Value, DateTimeKind.Utc);
            query = query.Where(r => r.ReadingAt <= to);
        }

        if (request.Types is { Count: > 0 })
            query = query.Where(r => request.Types.Contains(r.VitalSignType));

        if (request.Source.HasValue)
            query = query.Where(r => r.Source == request.Source.Value);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(r => r.ReadingAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new VitalSignReadingDto
            {
                Id = r.Id,
                PatientId = r.PatientId,
                VitalSignType = r.VitalSignType,
                Value = r.Value,
                Unit = r.Unit,
                ReadingAt = r.ReadingAt,
                Source = r.Source,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync(cancellationToken);

        IReadOnlyDictionary<string, VitalSignLatestDto>? latestByType = null;
        IReadOnlyDictionary<string, decimal>? averages7d = null;

        if (request.IncludeSummary)
        {
            var allForSummary = _context.Set<VitalSignReading>()
                .AsNoTracking()
                .Where(r => r.PatientId == patientId);

            if (request.Types is { Count: > 0 })
                allForSummary = allForSummary.Where(r => request.Types.Contains(r.VitalSignType));

            var latestRows = await allForSummary
                .OrderByDescending(r => r.ReadingAt)
                .ToListAsync(cancellationToken);

            latestByType = latestRows
                .GroupBy(r => r.VitalSignType)
                .Select(g => g.First())
                .ToDictionary(
                r => r.VitalSignType.ToString(),
                r => new VitalSignLatestDto(
                    r.Id,
                    r.Value,
                    r.Unit,
                    r.ReadingAt,
                    r.Source.ToString()));

            var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);
            averages7d = await allForSummary
                .Where(r => r.ReadingAt >= sevenDaysAgo)
                .GroupBy(r => r.VitalSignType)
                .Select(g => new { Type = g.Key, Avg = g.Average(r => r.Value) })
                .ToDictionaryAsync(x => x.Type.ToString(), x => x.Avg, cancellationToken);
        }

        return new VitalSignReadingsListResult
        {
            Page = new PagedResult<VitalSignReadingDto>(items, page, pageSize, totalCount),
            LatestByType = latestByType,
            Averages7d = averages7d
        };
    }
}
