using System.Security.Claims;
using VirtualMed.Application.Auth;

namespace VirtualMed.Application.Interfaces.Services;

public interface IJwtTokenService
{
    string GenerateAccessToken(UserTokenInfo user, IReadOnlyList<string> permissions);
    string GenerateRefreshToken();
    string GenerateTempTwoFactorToken(Guid userId);
    ClaimsPrincipal? ValidateAccessToken(string token);
    (bool Valid, Guid? UserId) ValidateRefreshToken(string token);
    (bool Valid, Guid? UserId) ValidateTempTwoFactorToken(string token);
    string HashToken(string token);
}
