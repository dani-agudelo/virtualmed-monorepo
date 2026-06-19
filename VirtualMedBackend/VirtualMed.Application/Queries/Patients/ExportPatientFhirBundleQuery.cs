using MediatR;

namespace VirtualMed.Application.Queries.Patients;

public record ExportPatientFhirBundleQuery(Guid? PatientId) : IRequest<string>;
