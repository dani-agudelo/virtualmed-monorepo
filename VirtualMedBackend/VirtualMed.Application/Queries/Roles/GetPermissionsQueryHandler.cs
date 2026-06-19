using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Roles;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Queries.Roles;

public class GetPermissionsQueryHandler : IRequestHandler<GetPermissionsQuery, IReadOnlyList<PermissionListItemDto>>
{
    private readonly IApplicationDbContext _context;

    public GetPermissionsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<PermissionListItemDto>> Handle(GetPermissionsQuery request, CancellationToken cancellationToken)
    {
        var list = await _context.Set<Permission>()
            .AsNoTracking()
            .OrderBy(p => p.Resource)
            .ThenBy(p => p.Action)
            .Select(p => new PermissionListItemDto(
                p.Id,
                p.Name,
                p.Resource,
                p.Action,
                $"{p.Resource}:{p.Action}"))
            .ToListAsync(cancellationToken);

        return list;
    }
}
