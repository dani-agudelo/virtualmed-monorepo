using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Auth;
using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.Configuration;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.Auth;

public class CompleteTwoFactorLoginCommandHandler
    : IRequestHandler<CompleteTwoFactorLoginCommand, LoginResult>
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly ITotpService _totpService;
    private readonly IEncryptionService _encryptionService;
    private readonly JwtSettings _jwtSettings;

    public CompleteTwoFactorLoginCommandHandler(
        IApplicationDbContext context,
        IJwtTokenService jwtTokenService,
        IRefreshTokenRepository refreshTokenRepository,
        ITotpService totpService,
        IEncryptionService encryptionService,
        JwtSettings jwtSettings)
    {
        _context = context;
        _jwtTokenService = jwtTokenService;
        _refreshTokenRepository = refreshTokenRepository;
        _totpService = totpService;
        _encryptionService = encryptionService;
        _jwtSettings = jwtSettings;
    }

    public async Task<LoginResult> Handle(
        CompleteTwoFactorLoginCommand request,
        CancellationToken cancellationToken)
    {
        var (valid, userId) = _jwtTokenService.ValidateTempTwoFactorToken(request.TempTwoFactorToken);
        if (!valid || userId == null)
            throw new UnauthorizedAccessException("Sesión de 2FA inválida o expirada. Inicie sesión de nuevo.");

        var user = await _context.Set<User>()
            .Include(u => u.Role)
            .ThenInclude(r => r!.Permissions)
            .FirstOrDefaultAsync(u => u.Id == userId.Value, cancellationToken);
        if (user == null || !user.TwoFactorEnabled)
            throw new UnauthorizedAccessException("Sesión de 2FA inválida o expirada. Inicie sesión de nuevo.");

        var twoFactor = await _context.Set<TwoFactorAuth>()
            .FirstOrDefaultAsync(t => t.UserId == user.Id, cancellationToken);
        if (twoFactor == null || !twoFactor.IsEnabled)
            throw new UnauthorizedAccessException("Configuración de 2FA no encontrada.");

        var secret = _encryptionService.Decrypt(twoFactor.SecretKeyEncrypted);
        var isValidCode = _totpService.ValidateCode(secret, request.Code);
        if (!isValidCode)
        {
            var recoveryCodes = JsonSerializer.Deserialize<List<string>>(
                _encryptionService.Decrypt(twoFactor.RecoveryCodesEncrypted)) ?? new List<string>();
            if (!recoveryCodes.Contains(request.Code.Trim()))
                throw new BusinessRuleException("El código de autenticación de dos factores es inválido o ha expirado.");
        }

        var userInfo = new UserTokenInfo(
            user.Id,
            user.Email,
            user.FullName ?? "",
            user.Role.Name,
            user.Status ?? "Active",
            user.EmailVerified,
            user.TwoFactorEnabled);
        var permissions = user.Role.Permissions.Select(p => $"{p.Resource}:{p.Action}").ToList();
        var accessToken = _jwtTokenService.GenerateAccessToken(userInfo, permissions);
        var refreshToken = _jwtTokenService.GenerateRefreshToken();
        var refreshTokenHash = _jwtTokenService.HashToken(refreshToken);

        var refreshEntity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = refreshTokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(_jwtSettings.RefreshTokenDays),
            CreatedAt = DateTime.UtcNow
        };
        await _refreshTokenRepository.AddAsync(refreshEntity, cancellationToken);

        user.LastLoginAt = DateTime.UtcNow;
        _context.Update(user);
        await _context.SaveChangesAsync(cancellationToken);

        var expiresInSeconds = _jwtSettings.AccessTokenMinutes * 60;
        return new LoginResult
        {
            RequiresTwoFactor = false,
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresInSeconds = expiresInSeconds
        };
    }
}
