using FluentValidation;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Commands.Appointments;

public class CreateAppointmentCommandValidator : AbstractValidator<CreateAppointmentCommand>
{
    public CreateAppointmentCommandValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.Status)
            .Must(s => s is AppointmentStatus.Scheduled or AppointmentStatus.Confirmed)
            .WithMessage("New appointments must start as Scheduled or Confirmed.");

        RuleFor(x => x.PatientId)
            .NotEmpty()
            .MustAsync(async (id, ct) => await context.Set<Domain.Entities.Patient>().AnyAsync(p => p.Id == id, ct))
            .WithMessage("Patient not found.");

        RuleFor(x => x.DurationMinutes)
            .InclusiveBetween(1, 24 * 60)
            .WithMessage("Duration must be between 1 and 1440 minutes.");

        RuleFor(x => x.ScheduledAt)
            .LessThan(DateTime.UtcNow.AddYears(2))
            .WithMessage("Scheduled date is too far in the future.");

        RuleFor(x => x.Reason)
            .MaximumLength(1000)
            .When(x => !string.IsNullOrEmpty(x.Reason));

        RuleFor(x => x.DoctorId)
            .MustAsync(async (doctorId, ct) =>
                !doctorId.HasValue || await context.Set<Domain.Entities.Doctor>().AnyAsync(d => d.Id == doctorId.Value, ct))
            .WithMessage("Doctor not found.")
            .When(x => x.DoctorId.HasValue);
    }
}
