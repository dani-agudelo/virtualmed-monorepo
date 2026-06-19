using FluentValidation;

namespace VirtualMed.Application.Commands.Auth;

public class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(c => c.Email)
            .NotEmpty().WithMessage("El correo es requerido.")
            .EmailAddress().WithMessage("El correo no tiene un formato válido.");
        RuleFor(c => c.Password)
            .NotEmpty().WithMessage("La contraseña es requerida.");
    }
}
