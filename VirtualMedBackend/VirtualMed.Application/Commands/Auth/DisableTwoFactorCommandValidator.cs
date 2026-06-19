using System.Text.RegularExpressions;
using FluentValidation;

namespace VirtualMed.Application.Commands.Auth;

public class DisableTwoFactorCommandValidator
    : AbstractValidator<DisableTwoFactorCommand>
{
    public DisableTwoFactorCommandValidator()
    {
        RuleFor(x => x.RecoveryCode)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("El código de recuperación es obligatorio.")
            .Must(code =>
            {
                if (string.IsNullOrWhiteSpace(code))
                    return false;

                var normalized = code.Trim().ToUpperInvariant();
                return Regex.IsMatch(normalized, "^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$");
            })
            .WithMessage("El código de recuperación debe tener el formato XXXX-XXXX-XXXX con caracteres hexadecimales.");
    }
}