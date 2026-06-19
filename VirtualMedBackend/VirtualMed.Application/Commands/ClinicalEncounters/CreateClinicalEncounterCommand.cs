using MediatR;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Commands.ClinicalEncounters;

public record CreateClinicalEncounterCommand(
    Guid AppointmentId,
    EncounterType EncounterType,
    DateTime StartAt,
    DateTime? EndAt,
    string ChiefComplaint,
    string? CurrentCondition,
    string? PhysicalExam,
    string? Assessment,
    string? Plan,
    string? Notes,
    string? RecordingUrl,
    IReadOnlyCollection<CreateDiagnosisItem> Diagnoses) : IRequest<Guid>;

public record CreateDiagnosisItem(
    string Icd10Code,
    string Description,
    DiagnosisType Type);

