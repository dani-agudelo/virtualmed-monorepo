using FluentValidation;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Commands.VitalSigns;

public class RecordVitalSignReadingCommandValidator : AbstractValidator<RecordVitalSignReadingCommand>
{
    public RecordVitalSignReadingCommandValidator()
    {
        RuleFor(x => x.Readings)
            .NotEmpty()
            .WithMessage("Debe enviar al menos una lectura.");

        RuleForEach(x => x.Readings).ChildRules(item =>
        {
            item.RuleFor(x => x.Type)
                .IsInEnum()
                .WithMessage("Tipo de signo vital no válido.");

            item.RuleFor(x => x.Unit)
                .MaximumLength(32)
                .When(x => !string.IsNullOrEmpty(x.Unit));

            item.RuleFor(x => x.Notes)
                .MaximumLength(2000)
                .When(x => !string.IsNullOrEmpty(x.Notes));

            item.RuleFor(x => x.ReadingAt)
                .LessThan(DateTime.UtcNow.AddDays(1))
                .When(x => x.ReadingAt.HasValue)
                .WithMessage("La fecha de lectura no puede estar demasiado en el futuro.");
        });
    }
}
