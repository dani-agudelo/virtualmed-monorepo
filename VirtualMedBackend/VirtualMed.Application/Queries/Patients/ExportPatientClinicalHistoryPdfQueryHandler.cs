using MediatR;
using VirtualMed.Application.Documents;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Patients;

namespace VirtualMed.Application.Queries.Patients;

public class ExportPatientClinicalHistoryPdfQueryHandler : IRequestHandler<ExportPatientClinicalHistoryPdfQuery, byte[]>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public ExportPatientClinicalHistoryPdfQueryHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<byte[]> Handle(ExportPatientClinicalHistoryPdfQuery request, CancellationToken cancellationToken)
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

        return PatientClinicalHistoryPdfDocument.Generate(patient, encounters);
    }
}
