using MediatR;

namespace VirtualMed.Application.Commands.Roles;

public record UpdateRoleCommand(Guid RoleId, string Name, IReadOnlyList<Guid> PermissionIds) : IRequest<Unit>;
