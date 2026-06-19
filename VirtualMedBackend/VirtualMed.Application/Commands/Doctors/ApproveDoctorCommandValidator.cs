using FluentValidation;

namespace VirtualMed.Application.Commands.Doctors;

public class ApproveDoctorCommandValidator : AbstractValidator<ApproveDoctorCommand>
{
    public ApproveDoctorCommandValidator()
    {
        RuleFor(x => x.DoctorId)
            .NotEmpty()
            .WithMessage("El ID del doctor es requerido.");
    }
}
