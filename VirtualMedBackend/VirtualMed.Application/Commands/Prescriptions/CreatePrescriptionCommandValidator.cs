using FluentValidation;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Interfaces;

namespace VirtualMed.Application.Commands.Prescriptions;

public class CreatePrescriptionCommandValidator : AbstractValidator<CreatePrescriptionCommand>
{
    public CreatePrescriptionCommandValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.EncounterId)
            .NotEmpty()
            .MustAsync(async (id, ct) =>
                await context.Set<Domain.Entities.ClinicalEncounter>().AnyAsync(e => e.Id == id, ct))
            .WithMessage("Clinical encounter not found.");

        RuleFor(x => x.Lines)
            .NotNull()
            .Must(x => x.Count > 0)
            .WithMessage("At least one medication line is required.");

        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(x => x)
                .Must(x =>
                    (x.MedicationId.HasValue && string.IsNullOrWhiteSpace(x.MedicationName))
                    || (!x.MedicationId.HasValue && !string.IsNullOrWhiteSpace(x.MedicationName)))
                .WithMessage("Each line must have either MedicationId or MedicationName, not both.");

            line.RuleFor(x => x.Dosage).NotEmpty().MaximumLength(100);
            line.RuleFor(x => x.Frequency).NotEmpty().MaximumLength(100);
            line.RuleFor(x => x.DurationDays).GreaterThan(0).LessThanOrEqualTo(3650);
            line.RuleFor(x => x.Instructions).MaximumLength(1000).When(x => !string.IsNullOrEmpty(x.Instructions));
        });

        RuleFor(x => x.DoctorSignatureHash).MaximumLength(512).When(x => !string.IsNullOrEmpty(x.DoctorSignatureHash));
    }
}
