using MediatR;

namespace VirtualMed.Application.Commands.Auth;

public record RefreshTokenCommand(string RefreshToken) : IRequest<RefreshTokenResult>;

public class RefreshTokenResult
{
    public string AccessToken { get; init; } = default!;
    public string RefreshToken { get; init; } = default!;
    public int ExpiresInSeconds { get; init; }
}
