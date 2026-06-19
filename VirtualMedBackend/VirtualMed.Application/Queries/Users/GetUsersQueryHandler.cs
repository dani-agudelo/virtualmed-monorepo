using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Queries.Users;

public class GetUsersQueryHandler : IRequestHandler<GetUsersQuery, IReadOnlyList<UserListItemDto>>
{
    private readonly IApplicationDbContext _context;

    public GetUsersQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<UserListItemDto>> Handle(GetUsersQuery request, CancellationToken cancellationToken)
    {
        var doctorByUserId = await _context.Set<Doctor>()
            .AsNoTracking()
            .ToDictionaryAsync(d => d.UserId, d => d.Id, cancellationToken);

        var users = await _context.Set<User>()
            .AsNoTracking()
            .Include(u => u.Role)
            .OrderByDescending(u => u.CreatedAt)
            .ToListAsync(cancellationToken);

        return users.Select(u => new UserListItemDto(
                u.Id,
                u.FullName,
                u.Email,
                u.Status,
                u.RoleId,
                u.Role.Name,
                u.EmailVerified,
                u.TwoFactorEnabled,
                u.CreatedAt,
                u.LastLoginAt,
                doctorByUserId.TryGetValue(u.Id, out var doctorId) ? doctorId : null))
            .ToList();
    }
}
