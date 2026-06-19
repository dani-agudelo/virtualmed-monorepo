using MediatR;

namespace VirtualMed.Application.Queries.Patients;

public record ExportPatientClinicalHistoryPdfQuery(Guid? PatientId) : IRequest<byte[]>;
