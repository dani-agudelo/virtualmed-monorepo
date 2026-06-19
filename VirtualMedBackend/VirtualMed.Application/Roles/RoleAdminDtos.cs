namespace VirtualMed.Application.Roles;

public record RoleListItemDto(Guid Id, string Name, IReadOnlyList<string> PermissionKeys);

public record PermissionListItemDto(Guid Id, string Name, string Resource, string Action, string Key);
