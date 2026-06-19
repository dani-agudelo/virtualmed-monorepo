using FluentValidation;

namespace VirtualMed.Application.Commands.Users;

public class UpdateUserStatusCommandValidator : AbstractValidator<UpdateUserStatusCommand>
{
    private static readonly string[] AllowedStatuses = ["Active", "Pending", "Inactive"];

    public UpdateUserStatusCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Status)
            .NotEmpty()
            .Must(s => AllowedStatuses.Contains(s))
            .WithMessage("Status must be Active, Pending, or Inactive.");
    }
}
