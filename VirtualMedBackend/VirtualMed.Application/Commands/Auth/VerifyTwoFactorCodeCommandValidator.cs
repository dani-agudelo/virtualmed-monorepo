using System.Text.RegularExpressions;
using FluentValidation;

namespace VirtualMed.Application.Commands.Auth;

public class VerifyTwoFactorCodeCommandValidator
    : AbstractValidator<VerifyTwoFactorCodeCommand>
{
    public VerifyTwoFactorCodeCommandValidator()
    {
        RuleFor(x => x.Code)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("El código de autenticación de dos factores es obligatorio.")
            .Must(code =>
            {
                if (string.IsNullOrWhiteSpace(code))
                    return false;

                var normalized = code.Trim();
                return normalized.Length == 6 && Regex.IsMatch(normalized, "^[0-9]{6}$");
            })
            .WithMessage("El código de autenticación de dos factores debe tener exactamente 6 dígitos numéricos.");
    }
}