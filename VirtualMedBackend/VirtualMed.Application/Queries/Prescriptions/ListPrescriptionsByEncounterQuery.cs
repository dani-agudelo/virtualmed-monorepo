using MediatR;

namespace VirtualMed.Application.Queries.Prescriptions;

public record ListPrescriptionsByEncounterQuery(Guid EncounterId) : IRequest<IReadOnlyCollection<PrescriptionDetailDto>>;
