using FluentValidation;

namespace VirtualMed.Application.Commands.VitalSigns;

public class SyncSimulatedVitalReadingsCommandValidator : AbstractValidator<SyncSimulatedVitalReadingsCommand>
{
    public SyncSimulatedVitalReadingsCommandValidator()
    {
        RuleFor(x => x.Readings)
            .NotEmpty()
            .WithMessage("Debe enviar al menos una lectura.");
    }
}
