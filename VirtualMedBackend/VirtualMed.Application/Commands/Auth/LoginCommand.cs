using MediatR;

namespace VirtualMed.Application.Commands.Auth;

public record LoginCommand(string Email, string Password) : IRequest<LoginResult>;

public class LoginResult
{
    public bool RequiresTwoFactor { get; init; }
    public string? TempTwoFactorToken { get; init; }
    public string? AccessToken { get; init; }
    public string? RefreshToken { get; init; }
    public int? ExpiresInSeconds { get; init; }
}
