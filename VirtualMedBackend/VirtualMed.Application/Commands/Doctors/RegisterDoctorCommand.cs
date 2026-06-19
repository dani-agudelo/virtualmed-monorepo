using MediatR;
using Microsoft.AspNetCore.Http;
namespace VirtualMed.Application.Commands.Doctors
{
    public record RegisterDoctorCommand(
    string FullName,
    string Email,
    string Password,
    string ProfessionalLicense,
    IFormFile? SupportingDocument,
    string? DocumentFileName
) : IRequest<Guid>;

}
