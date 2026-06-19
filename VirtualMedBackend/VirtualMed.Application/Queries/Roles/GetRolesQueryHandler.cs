using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Roles;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Queries.Roles;

public class GetRolesQueryHandler : IRequestHandler<GetRolesQuery, IReadOnlyList<RoleListItemDto>>
{
    private readonly IApplicationDbContext _context;

    public GetRolesQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<RoleListItemDto>> Handle(GetRolesQuery request, CancellationToken cancellationToken)
    {
        var roles = await _context.Set<Role>()
            .AsNoTracking()
            .Include(r => r.Permissions)
            .OrderBy(r => r.Name)
            .ToListAsync(cancellationToken);

        return roles.Select(r => new RoleListItemDto(
                r.Id,
                r.Name,
                r.Permissions.Select(p => $"{p.Resource}:{p.Action}").OrderBy(k => k).ToList()))
            .ToList();
    }
}
