using FluentValidation;

namespace VirtualMed.Application.Commands.Auth;

public class RefreshTokenCommandValidator : AbstractValidator<RefreshTokenCommand>
{
    public RefreshTokenCommandValidator()
    {
        RuleFor(c => c.RefreshToken)
            .NotEmpty().WithMessage("El token de actualización es requerido.");
    }
}
