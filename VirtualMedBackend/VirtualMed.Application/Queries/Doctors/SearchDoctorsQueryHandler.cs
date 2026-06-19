using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Common.Models;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Queries.Doctors;

public class SearchDoctorsQueryHandler : IRequestHandler<SearchDoctorsQuery, PagedResult<DoctorSearchItemDto>>
{
    private const int MaxPageSize = 50;

    private readonly IApplicationDbContext _context;

    public SearchDoctorsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<DoctorSearchItemDto>> Handle(
        SearchDoctorsQuery request,
        CancellationToken cancellationToken)
    {
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? 20 : Math.Min(request.PageSize, MaxPageSize);

        var query = _context.Set<Doctor>().AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Q))
        {
            var term = request.Q.Trim().ToLower();
            query = query.Where(d =>
                d.User.FullName.ToLower().Contains(term)
                || d.ProfessionalLicense.ToLower().Contains(term));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(d => d.User.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(d => new DoctorSearchItemDto
            {
                Id = d.Id,
                FullName = d.User.FullName,
                ProfessionalLicense = d.ProfessionalLicense
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<DoctorSearchItemDto>(items, page, pageSize, totalCount);
    }
}
