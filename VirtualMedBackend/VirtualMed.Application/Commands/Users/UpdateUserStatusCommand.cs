using MediatR;

namespace VirtualMed.Application.Commands.Users;

public record UpdateUserStatusCommand(Guid UserId, string Status) : IRequest<Unit>;
