namespace VirtualMed.Application.Interfaces.Services;

public interface IRbacAuthorizationService
{
    Task<bool> UserHasPermissionAsync(Guid userId, string resource, string action, CancellationToken cancellationToken = default);

    Task<bool> UserHasPermissionAsync(Guid userId, string permissionKey, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<string>> GetUserPermissionKeysAsync(Guid userId, CancellationToken cancellationToken = default);
}
