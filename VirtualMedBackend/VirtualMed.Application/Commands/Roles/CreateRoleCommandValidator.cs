using FluentValidation;

namespace VirtualMed.Application.Commands.Roles;

public class CreateRoleCommandValidator : AbstractValidator<CreateRoleCommand>
{
    public CreateRoleCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(50);

        RuleFor(x => x.PermissionIds)
            .NotNull();
    }
}
