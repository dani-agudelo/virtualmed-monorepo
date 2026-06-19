using MediatR;

namespace VirtualMed.Application.Queries.ClinicalEncounters;

public record GetClinicalEncounterByIdQuery(Guid Id) : IRequest<ClinicalEncounterDetailDto>;

