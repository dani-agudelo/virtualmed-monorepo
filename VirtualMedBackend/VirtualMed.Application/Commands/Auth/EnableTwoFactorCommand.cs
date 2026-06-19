using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Application.Exceptions;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.Auth;

public record EnableTwoFactorCommand(Guid UserId) : IRequest<EnableTwoFactorResult>;

public class EnableTwoFactorResult
{
    public string OtpauthUri { get; init; } = default!;
    public string Secret { get; init; } = default!;
    public IReadOnlyList<string> RecoveryCodes { get; init; } = Array.Empty<string>();
}

public class EnableTwoFactorCommandHandler
    : IRequestHandler<EnableTwoFactorCommand, EnableTwoFactorResult>
{
    private readonly IApplicationDbContext _context;
    private readonly ITotpService _totpService;
    private readonly IEncryptionService _encryptionService;

    public EnableTwoFactorCommandHandler(
        IApplicationDbContext context,
        ITotpService totpService,
        IEncryptionService encryptionService)
    {
        _context = context;
        _totpService = totpService;
        _encryptionService = encryptionService;
    }

    public async Task<EnableTwoFactorResult> Handle(
        EnableTwoFactorCommand request,
        CancellationToken cancellationToken)
    {
        var user = await _context.Set<User>()
            .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
        if (user == null)
            throw new NotFoundException("Usuario no encontrado.");

        if (user.TwoFactorEnabled)
            throw new BusinessRuleException("La autenticación de dos factores ya está habilitada para este usuario.");

        var secret = _totpService.GenerateSecret();
        var otpauthUri = _totpService.GenerateOtpAuthUri("VirtualMed", user.Email, secret);
        var recoveryCodes = _totpService.GenerateRecoveryCodes(10);

        var encryptedSecret = _encryptionService.Encrypt(secret);
        var recoveryCodesJson = JsonSerializer.Serialize(recoveryCodes);
        var encryptedRecoveryCodes = _encryptionService.Encrypt(recoveryCodesJson);

        var existing = await _context.Set<TwoFactorAuth>()
            .FirstOrDefaultAsync(t => t.UserId == request.UserId, cancellationToken);

        if (existing == null)
        {
            var twoFactor = new TwoFactorAuth
            {
                UserId = request.UserId,
                SecretKeyEncrypted = encryptedSecret,
                RecoveryCodesEncrypted = encryptedRecoveryCodes,
                IsEnabled = false,
                CreatedAt = DateTime.UtcNow
            };

            _context.Add(twoFactor);
        }
        else
        {
            existing.SecretKeyEncrypted = encryptedSecret;
            existing.RecoveryCodesEncrypted = encryptedRecoveryCodes;
            existing.IsEnabled = false;
            existing.UpdatedAt = DateTime.UtcNow;

            _context.Update(existing);
        }

        user.TwoFactorEnabled = false;
        _context.Update(user);

        await _context.SaveChangesAsync(cancellationToken);

        return new EnableTwoFactorResult
        {
            OtpauthUri = otpauthUri,
            Secret = secret,
            RecoveryCodes = recoveryCodes
        };
    }
}

