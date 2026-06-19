using Hl7.Fhir.Serialization;
using MediatR;
using VirtualMed.Application.Fhir;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Patients;

namespace VirtualMed.Application.Queries.Patients;

public class ExportPatientFhirBundleQueryHandler : IRequestHandler<ExportPatientFhirBundleQuery, string>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public ExportPatientFhirBundleQueryHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<string> Handle(ExportPatientFhirBundleQuery request, CancellationToken cancellationToken)
    {
        var patientId = await PatientClinicalHistoryExportDataLoader.ResolveTargetPatientIdForExportAsync(
            _context,
            _currentUserService,
            request.PatientId,
            cancellationToken);

        var (patient, encounters) = await PatientClinicalHistoryExportDataLoader.LoadAuthorizedAsync(
            _context,
            _currentUserService,
            patientId,
            cancellationToken);

        var bundle = PatientHistoryFhirBundleBuilder.Build(patient, encounters);
        return bundle.ToJson(false);
    }
}
