using MediatR;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Interfaces.Services;

namespace VirtualMed.Application.Commands.Auth;

public class LogoutCommandHandler : IRequestHandler<LogoutCommand>
{
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IJwtTokenService _jwtTokenService;

    public LogoutCommandHandler(
        IRefreshTokenRepository refreshTokenRepository,
        IJwtTokenService jwtTokenService)
    {
        _refreshTokenRepository = refreshTokenRepository;
        _jwtTokenService = jwtTokenService;
    }

    public async Task Handle(LogoutCommand request, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            var hash = _jwtTokenService.HashToken(request.RefreshToken);
            var stored = await _refreshTokenRepository.GetByTokenHashAsync(hash, cancellationToken);
            if (stored != null)
                await _refreshTokenRepository.RevokeByIdAsync(stored.Id, cancellationToken);
        }
        else
        {
            await _refreshTokenRepository.RevokeByUserIdAsync(request.UserId, cancellationToken);
        }
    }
}
