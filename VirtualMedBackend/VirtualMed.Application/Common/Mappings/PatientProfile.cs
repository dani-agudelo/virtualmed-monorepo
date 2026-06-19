using AutoMapper;
using VirtualMed.Application.Patients;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Common.Mappings;

public class PatientProfile : Profile
{
    public PatientProfile()
    {
        CreateMap<Patient, PatientDto>()
            .ForMember(d => d.FullName, o => o.MapFrom(s => s.User.FullName))
            .ReverseMap();
    }
}

