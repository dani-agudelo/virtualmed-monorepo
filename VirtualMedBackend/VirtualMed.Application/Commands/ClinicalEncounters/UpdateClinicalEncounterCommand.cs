using MediatR;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Commands.ClinicalEncounters;

public record UpdateClinicalEncounterCommand(
    Guid Id,
    EncounterType? EncounterType,
    DateTime? StartAt,
    DateTime? EndAt,
    string? ChiefComplaint,
    string? CurrentCondition,
    string? PhysicalExam,
    string? Assessment,
    string? Plan,
    string? Notes,
    string? RecordingUrl,
    bool? IsLocked,
    IReadOnlyCollection<UpdateClinicalEncounterDiagnosisItem>? Diagnoses) : IRequest;

public record UpdateClinicalEncounterDiagnosisItem(
    string Icd10Code,
    string Description,
    DiagnosisType Type);
