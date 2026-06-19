using MediatR;

namespace VirtualMed.Application.Commands.Doctors;

public class ApproveDoctorCommand : IRequest<Unit>
{
    public Guid DoctorId { get; set; }
}
