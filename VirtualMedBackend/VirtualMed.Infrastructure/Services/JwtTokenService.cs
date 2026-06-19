using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using VirtualMed.Application.Auth;
using VirtualMed.Application.Configuration;
using VirtualMed.Application.Interfaces.Services;

namespace VirtualMed.Infrastructure.Services;

public class JwtTokenService : IJwtTokenService
{
    public const string ClaimSub = "sub";
    public const string ClaimEmail = "email";
    public const string ClaimRole = "role";
    public const string ClaimFullName = "fullname";
    public const string ClaimStatus = "status";
    public const string ClaimEmailVerified = "email_verified";
    public const string ClaimTwoFactorEnabled = "two_factor_enabled";
    public const string ClaimPermission = "permission";

    private readonly JwtSettings _settings;
    private readonly byte[] _keyBytes;
    private readonly ILogger<JwtTokenService> _logger;

    public JwtTokenService(IOptions<JwtSettings> options, ILogger<JwtTokenService> logger)
    {
        _settings = options.Value;
        _keyBytes = Encoding.UTF8.GetBytes(_settings.Key);
        _logger = logger;
    }

    public string GenerateAccessToken(UserTokenInfo user, IReadOnlyList<string> permissions)
    {
        var claims = new List<Claim>
        {
            new(ClaimSub, user.Id.ToString()),
            new(ClaimEmail, user.Email),
            new(ClaimRole, user.RoleName),
            new(ClaimFullName, user.FullName ?? string.Empty),
            new(ClaimStatus, user.Status ?? string.Empty),
            new(ClaimEmailVerified, user.EmailVerified ? "true" : "false"),
            new(ClaimTwoFactorEnabled, user.TwoFactorEnabled ? "true" : "false")
        };
        foreach (var p in permissions)
            claims.Add(new Claim(ClaimPermission, p));
        return BuildToken(claims, TimeSpan.FromMinutes(_settings.AccessTokenMinutes));
    }

    public string GenerateRefreshToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
    }

    public string GenerateTempTwoFactorToken(Guid userId)
    {
        var claims = new[]
        {
            new Claim(ClaimSub, userId.ToString()),
            new Claim("2fa_temp", "1")
        };
        return BuildToken(claims, TimeSpan.FromMinutes(_settings.TempTwoFactorTokenMinutes));
    }

    public ClaimsPrincipal? ValidateAccessToken(string token)
    {
        return ValidateToken(token, validateLifetime: true, expect2FaTemp: false);
    }

    public (bool Valid, Guid? UserId) ValidateRefreshToken(string token)
    {
        try
        {
            var principal = new JwtSecurityTokenHandler().ValidateToken(token, GetValidationParameters(validateLifetime: true), out _);
            var sub = principal.FindFirst(ClaimSub)?.Value ?? principal.FindFirst("sub")?.Value;
            if (sub != null && Guid.TryParse(sub, out var userId))
                return (true, userId);
            return (false, null);
        }
        catch
        {
            return (false, null);
        }
    }

    public (bool Valid, Guid? UserId) ValidateTempTwoFactorToken(string token)
    {
        var principal = ValidateToken(token, validateLifetime: true, expect2FaTemp: true);
        if (principal == null) return (false, null);
        var sub = principal.FindFirst(ClaimSub)?.Value ?? principal.FindFirst("sub")?.Value;
        if (sub != null && Guid.TryParse(sub, out var userId))
            return (true, userId);
        return (false, null);
    }

    public string HashToken(string token)
    {
        var bytes = Encoding.UTF8.GetBytes(token);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }

    private string BuildToken(IEnumerable<Claim> claims, TimeSpan validFor)
    {
        var creds = new SigningCredentials(
            new SymmetricSecurityKey(_keyBytes),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.Add(validFor),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private TokenValidationParameters GetValidationParameters(bool validateLifetime)
    {
        return new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(_keyBytes),
            ValidateIssuer = true,
            ValidIssuer = _settings.Issuer,
            ValidateAudience = true,
            ValidAudience = _settings.Audience,
            ValidateLifetime = validateLifetime,
            ClockSkew = TimeSpan.Zero
        };
    }

    private ClaimsPrincipal? ValidateToken(string token, bool validateLifetime, bool expect2FaTemp)
{
    try
    {
        var parameters = GetValidationParameters(validateLifetime);

        var handler = new JwtSecurityTokenHandler
        {
            MapInboundClaims = false
        };

        var principal = handler.ValidateToken(token, parameters, out var validatedToken);

        if (expect2FaTemp && principal.FindFirst("2fa_temp")?.Value != "1")
            return null;

        return principal;
    }
    catch (Exception ex)
    {
        _logger.LogWarning(ex,
            "Error validating JWT token. validateLifetime={ValidateLifetime}, expect2FaTemp={Expect2FaTemp}",
            validateLifetime, expect2FaTemp);
        return null;
    }
}
}
