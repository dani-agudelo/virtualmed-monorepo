using MediatR;

namespace VirtualMed.Application.Commands.Users;

public record AssignUserRoleCommand(Guid UserId, Guid RoleId) : IRequest<Unit>;
