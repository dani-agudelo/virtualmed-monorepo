using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.Auth;

public record DisableTwoFactorCommand(Guid UserId, string RecoveryCode) : IRequest;

public class DisableTwoFactorCommandHandler
    : IRequestHandler<DisableTwoFactorCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IEncryptionService _encryptionService;

    public DisableTwoFactorCommandHandler(
        IApplicationDbContext context,
        IEncryptionService encryptionService)
    {
        _context = context;
        _encryptionService = encryptionService;
    }

    public async Task Handle(
        DisableTwoFactorCommand request,
        CancellationToken cancellationToken)
    {
        var user = await _context.Set<User>()
            .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
        if (user == null)
            throw new NotFoundException("Usuario no encontrado.");

        var twoFactor = await _context.Set<TwoFactorAuth>()
            .FirstOrDefaultAsync(t => t.UserId == request.UserId, cancellationToken);

        if (twoFactor == null || !twoFactor.IsEnabled)
            throw new BusinessRuleException("La autenticación de dos factores no está habilitada para este usuario.");

        var recoveryCodesJson = _encryptionService.Decrypt(twoFactor.RecoveryCodesEncrypted);
        var recoveryCodes = JsonSerializer.Deserialize<List<string>>(recoveryCodesJson) ?? new List<string>();

        var codeToCheck = (request.RecoveryCode ?? string.Empty).Trim().ToUpperInvariant();

        if (!recoveryCodes.Contains(codeToCheck))
            throw new BusinessRuleException("El código de recuperación proporcionado no es válido.");

        recoveryCodes.Remove(codeToCheck);

        twoFactor.SecretKeyEncrypted = string.Empty;
        twoFactor.RecoveryCodesEncrypted = string.Empty;
        twoFactor.IsEnabled = false;
        twoFactor.UpdatedAt = DateTime.UtcNow;
        _context.Update(twoFactor);

        user.TwoFactorEnabled = false;
        _context.Update(user);

        await _context.SaveChangesAsync(cancellationToken);
    }
}