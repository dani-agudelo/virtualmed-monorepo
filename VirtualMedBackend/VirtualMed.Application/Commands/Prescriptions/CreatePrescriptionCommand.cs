using MediatR;

namespace VirtualMed.Application.Commands.Prescriptions;

public record CreatePrescriptionCommand(
    Guid EncounterId,
    DateTime IssuedAt,
    DateOnly? ValidUntil,
    string? DoctorSignatureHash,
    IReadOnlyCollection<CreatePrescriptionLineItem> Lines) : IRequest<Guid>;

public record CreatePrescriptionLineItem(
    Guid? MedicationId,
    string? MedicationName,
    string Dosage,
    string Frequency,
    int DurationDays,
    string? Instructions);
