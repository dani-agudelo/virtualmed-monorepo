using AutoMapper;
using MediatR;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Patients;

namespace VirtualMed.Application.Queries.Patients;

public class GetPatientByIdQueryHandler : IRequestHandler<GetPatientByIdQuery, PatientDto?>
{
    private readonly IPatientRepository _patientRepository;
    private readonly IMapper _mapper;

    public GetPatientByIdQueryHandler(IPatientRepository patientRepository, IMapper mapper)
    {
        _patientRepository = patientRepository;
        _mapper = mapper;
    }

    public async Task<PatientDto?> Handle(
        GetPatientByIdQuery request,
        CancellationToken cancellationToken)
    {
        var patient = await _patientRepository.GetByIdAsync(request.Id);
        return patient == null ? null : _mapper.Map<PatientDto>(patient);
    }
}
