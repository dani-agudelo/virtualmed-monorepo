using MediatR;

namespace VirtualMed.Application.Commands.Roles;

public record CreateRoleCommand(string Name, IReadOnlyList<Guid> PermissionIds) : IRequest<Guid>;
