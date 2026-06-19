using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Domain.Entities;
using VirtualMed.Infrastructure.Persistence;

namespace VirtualMed.Infrastructure.Services;

public class RbacAuthorizationService : IRbacAuthorizationService
{
    private readonly ApplicationDbContext _db;

    public RbacAuthorizationService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<bool> UserHasPermissionAsync(Guid userId, string resource, string action, CancellationToken cancellationToken = default)
    {
        var key = $"{resource}:{action}";
        return await UserHasPermissionAsync(userId, key, cancellationToken);
    }

    public async Task<bool> UserHasPermissionAsync(Guid userId, string permissionKey, CancellationToken cancellationToken = default)
    {
        var keys = await GetUserPermissionKeysAsync(userId, cancellationToken);
        return keys.Contains(permissionKey, StringComparer.Ordinal);
    }

    public async Task<IReadOnlyList<string>> GetUserPermissionKeysAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users
            .AsNoTracking()
            .Include(u => u.Role)
            .ThenInclude(r => r!.Permissions)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user?.Role?.Permissions == null)
            return Array.Empty<string>();

        return user.Role.Permissions
            .Select(p => $"{p.Resource}:{p.Action}")
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }
}
