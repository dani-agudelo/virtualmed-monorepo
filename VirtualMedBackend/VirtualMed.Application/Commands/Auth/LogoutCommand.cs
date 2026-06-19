using MediatR;

namespace VirtualMed.Application.Commands.Auth;

public record LogoutCommand(Guid UserId, string? RefreshToken) : IRequest;
