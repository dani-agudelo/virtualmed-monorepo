using FluentValidation;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Commands.ClinicalEncounters;

public class CreateClinicalEncounterCommandValidator : AbstractValidator<CreateClinicalEncounterCommand>
{
    private const string Icd10Regex = "^[A-TV-Z][0-9][0-9AB](\\.[0-9A-TV-Z]{1,4})?$";

    public CreateClinicalEncounterCommandValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.EncounterType)
            .IsInEnum()
            .WithMessage("EncounterType no es válido.");

        RuleFor(x => x.AppointmentId)
            .NotEmpty().WithMessage("AppointmentId is required.")
            .MustAsync(async (appointmentId, ct) =>
                await context.Set<Domain.Entities.Appointment>().AnyAsync(a => a.Id == appointmentId, ct))
            .WithMessage("Appointment not found.");

        RuleFor(x => x.StartAt)
            .LessThanOrEqualTo(DateTime.UtcNow.AddMinutes(1))
            .WithMessage("StartAt cannot be in the future.");

        RuleFor(x => x.EndAt)
            .GreaterThanOrEqualTo(x => x.StartAt)
            .When(x => x.EndAt.HasValue)
            .WithMessage("EndAt cannot be before StartAt.");

        RuleFor(x => x.ChiefComplaint)
            .NotEmpty().WithMessage("ChiefComplaint is required.")
            .MaximumLength(500).WithMessage("ChiefComplaint must not exceed 500 characters.");

        RuleFor(x => x.Diagnoses)
            .NotNull().WithMessage("Diagnoses are required.")
            .Must(x => x.Count > 0).WithMessage("At least one diagnosis is required.");

        RuleForEach(x => x.Diagnoses).ChildRules(d =>
        {
            d.RuleFor(x => x.Icd10Code)
                .NotEmpty().WithMessage("ICD-10 code is required.")
                .Matches(Icd10Regex).WithMessage("Invalid ICD-10 code format.");

            d.RuleFor(x => x.Description)
                .NotEmpty().WithMessage("Diagnosis description is required.")
                .MaximumLength(500).WithMessage("Diagnosis description must not exceed 500 characters.");
        });
    }
}

