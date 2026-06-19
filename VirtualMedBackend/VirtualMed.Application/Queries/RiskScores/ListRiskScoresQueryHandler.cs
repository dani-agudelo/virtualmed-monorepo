using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Common.Models;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.RiskScores;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Queries.RiskScores;

public class ListRiskScoresQueryHandler : IRequestHandler<ListRiskScoresQuery, PagedResult<RiskScoreDto>>
{
    private const int MaxPageSize = 50;

    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public ListRiskScoresQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<PagedResult<RiskScoreDto>> Handle(
        ListRiskScoresQuery request,
        CancellationToken cancellationToken)
    {
        var patientId = await PatientRiskScoreAccessResolver.ResolvePatientIdForReadAsync(
            _context,
            _currentUser,
            request.PatientId,
            cancellationToken);

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? 20 : Math.Min(request.PageSize, MaxPageSize);

        var query = _context.Set<RiskScore>()
            .AsNoTracking()
            .Where(r => r.PatientId == patientId);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(r => r.CalculatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new RiskScoreDto
            {
                Id = r.Id,
                PatientId = r.PatientId,
                Score = r.Score,
                RiskLevel = r.RiskLevel,
                ModelVersion = r.ModelVersion,
                DisclaimerVersion = r.DisclaimerVersion,
                CalculatedAt = r.CalculatedAt
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<RiskScoreDto>(items, page, pageSize, totalCount);
    }
}
