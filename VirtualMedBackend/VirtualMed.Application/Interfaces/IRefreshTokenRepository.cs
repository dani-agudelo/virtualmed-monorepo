using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Interfaces;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default);
    Task AddAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default);
    Task RevokeByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task RevokeByIdAsync(Guid id, CancellationToken cancellationToken = default);
}
