using FluentValidation;

namespace VirtualMed.Application.Commands.Appointments;

public class UpdateAppointmentCommandValidator : AbstractValidator<UpdateAppointmentCommand>
{
    public UpdateAppointmentCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();

        RuleFor(x => x)
            .Must(x => x.Status.HasValue || x.ScheduledAt.HasValue || x.DurationMinutes.HasValue ||
                       x.Reason != null)
            .WithMessage("At least one field must be provided to update.");

        RuleFor(x => x.DurationMinutes)
            .InclusiveBetween(1, 24 * 60)
            .When(x => x.DurationMinutes.HasValue);

        RuleFor(x => x.Reason)
            .MaximumLength(1000)
            .When(x => !string.IsNullOrEmpty(x.Reason));
    }
}
