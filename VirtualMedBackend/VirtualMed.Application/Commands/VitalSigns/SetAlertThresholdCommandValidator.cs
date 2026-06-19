using FluentValidation;

namespace VirtualMed.Application.Commands.VitalSigns;

public class SetAlertThresholdCommandValidator : AbstractValidator<SetAlertThresholdCommand>
{
    public SetAlertThresholdCommandValidator()
    {
        RuleFor(x => x.VitalSignType).IsInEnum();
    }
}
