using MediatR;

namespace VirtualMed.Application.Queries.Prescriptions;

public record GetPrescriptionByIdQuery(Guid Id) : IRequest<PrescriptionDetailDto?>;
