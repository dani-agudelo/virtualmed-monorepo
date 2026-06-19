using MediatR;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Queries.ClinicalEncounters;

public record ListClinicalEncountersQuery(
    Guid? PatientId,
    Guid? DoctorId,
    DateTime? From,
    DateTime? To,
    EncounterType? EncounterType) : IRequest<IReadOnlyCollection<ClinicalEncounterListItemDto>>;
