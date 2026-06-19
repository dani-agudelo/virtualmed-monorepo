using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Auth;
using VirtualMed.Application.Configuration;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.Auth;

public class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResult>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly JwtSettings _jwtSettings;

    public LoginCommandHandler(
        IApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtTokenService,
        IRefreshTokenRepository refreshTokenRepository,
        JwtSettings jwtSettings)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
        _refreshTokenRepository = refreshTokenRepository;
        _jwtSettings = jwtSettings;
    }

    public async Task<LoginResult> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await _context.Set<User>()
            .Include(u => u.Role)
            .ThenInclude(r => r!.Permissions)
            .FirstOrDefaultAsync(u => u.Email == request.Email, cancellationToken);

        if (user == null || !_passwordHasher.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Credenciales inválidas.");

        if (user.Status != "Active")
            throw new UnauthorizedAccessException("Su cuenta está pendiente o inactiva.");

        if (user.Role.Name == "Doctor")
        {
            var doctor = await _context.Set<Doctor>()
                .FirstOrDefaultAsync(d => d.UserId == user.Id, cancellationToken);
            if (doctor == null || !doctor.Verified)
                throw new UnauthorizedAccessException("Credenciales inválidas.");
        }

        if (user.TwoFactorEnabled)
        {
            var tempToken = _jwtTokenService.GenerateTempTwoFactorToken(user.Id);
            return new LoginResult
            {
                RequiresTwoFactor = true,
                TempTwoFactorToken = tempToken
            };
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
