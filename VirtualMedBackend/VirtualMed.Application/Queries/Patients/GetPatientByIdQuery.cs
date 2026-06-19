using MediatR;
using VirtualMed.Application.Patients;

namespace VirtualMed.Application.Queries.Patients;

public record GetPatientByIdQuery(Guid Id) : IRequest<PatientDto?>;
