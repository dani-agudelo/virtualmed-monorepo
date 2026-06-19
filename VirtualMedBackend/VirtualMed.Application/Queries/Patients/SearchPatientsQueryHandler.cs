using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Common.Models;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Queries.Patients;

public class SearchPatientsQueryHandler : IRequestHandler<SearchPatientsQuery, PagedResult<PatientSearchItemDto>>
{
    private const int MaxPageSize = 50;

    private readonly IApplicationDbContext _context;

    public SearchPatientsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<PatientSearchItemDto>> Handle(
        SearchPatientsQuery request,
        CancellationToken cancellationToken)
    {
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? 20 : Math.Min(request.PageSize, MaxPageSize);

        var query = _context.Set<Patient>().AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Q))
        {
            var term = request.Q.Trim().ToLower();
            query = query.Where(p =>
                p.User.FullName.ToLower().Contains(term)
                || p.Document.ToLower().Contains(term));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(p => p.User.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new PatientSearchItemDto
            {
                Id = p.Id,
                FullName = p.User.FullName,
                Document = p.Document
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<PatientSearchItemDto>(items, page, pageSize, totalCount);
    }
}
