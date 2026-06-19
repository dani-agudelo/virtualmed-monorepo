using FluentValidation;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Commands.ClinicalEncounters;

public class UpdateClinicalEncounterCommandValidator : AbstractValidator<UpdateClinicalEncounterCommand>
{
    private const string Icd10Regex = "^[A-TV-Z][0-9][0-9AB](\\.[0-9A-TV-Z]{1,4})?$";

    public UpdateClinicalEncounterCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();

        RuleFor(x => x.EncounterType!.Value)
            .IsInEnum()
            .When(x => x.EncounterType.HasValue);

        RuleFor(x => x)
            .Must(HasAtLeastOneChange)
            .WithMessage("Debe indicar al menos un campo a actualizar.");

        RuleFor(x => x.ChiefComplaint)
            .NotEmpty()
            .MaximumLength(500)
            .When(x => x.ChiefComplaint is not null);

        RuleFor(x => x.EndAt)
            .GreaterThanOrEqualTo(x => x.StartAt!.Value)
            .When(x => x.EndAt.HasValue && x.StartAt.HasValue)
            .WithMessage("EndAt no puede ser anterior a StartAt.");

        RuleForEach(x => x.Diagnoses!).ChildRules(d =>
        {
            d.RuleFor(x => x.Icd10Code)
                .NotEmpty()
                .Matches(Icd10Regex)
                .WithMessage("Formato de código ICD-10 inválido.");

            d.RuleFor(x => x.Description)
                .NotEmpty()
                .MaximumLength(500);
        }).When(x => x.Diagnoses is not null);

        RuleFor(x => x.Diagnoses!)
            .Must(d => d.Count > 0)
            .When(x => x.Diagnoses is not null)
            .WithMessage("Si envía diagnósticos, debe incluir al menos uno.");
    }

    private static bool HasAtLeastOneChange(UpdateClinicalEncounterCommand x) =>
        x.EncounterType.HasValue
        || x.StartAt.HasValue
        || x.EndAt.HasValue
        || x.ChiefComplaint is not null
        || x.CurrentCondition is not null
        || x.PhysicalExam is not null
        || x.Assessment is not null
        || x.Plan is not null
        || x.Notes is not null
        || x.RecordingUrl is not null
        || x.IsLocked.HasValue
        || x.Diagnoses is not null;
}
