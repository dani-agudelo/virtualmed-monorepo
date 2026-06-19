using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.Auth;

public record VerifyTwoFactorCodeCommand(Guid UserId, string Code) : IRequest;

public class VerifyTwoFactorCodeCommandHandler
    : IRequestHandler<VerifyTwoFactorCodeCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly ITotpService _totpService;
    private readonly IEncryptionService _encryptionService;

    public VerifyTwoFactorCodeCommandHandler(
        IApplicationDbContext context,
        ITotpService totpService,
        IEncryptionService encryptionService)
    {
        _context = context;
        _totpService = totpService;
        _encryptionService = encryptionService;
    }

    public async Task Handle(
        VerifyTwoFactorCodeCommand request,
        CancellationToken cancellationToken)
    {
        var user = await _context.Set<User>()
            .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
        if (user == null)
            throw new NotFoundException("Usuario no encontrado.");

        var twoFactor = await _context.Set<TwoFactorAuth>()
            .FirstOrDefaultAsync(t => t.UserId == request.UserId, cancellationToken);

        if (twoFactor == null)
            throw new NotFoundException("Configuración de 2FA no encontrada.");

        var secret = _encryptionService.Decrypt(twoFactor.SecretKeyEncrypted);

        var isValid = _totpService.ValidateCode(secret, request.Code);
        if (!isValid)
            throw new BusinessRuleException("El código de autenticación de dos factores es inválido o ha expirado.");

        twoFactor.IsEnabled = true;
        twoFactor.UpdatedAt = DateTime.UtcNow;
        _context.Update(twoFactor);

        user.TwoFactorEnabled = true;
        _context.Update(user);

        await _context.SaveChangesAsync(cancellationToken);
    }
}