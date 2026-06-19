
using MediatR;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Commands.Patients;

public record CreatePatientCommand(
    string FullName,
    string Email,
    string Password,
    string ConfirmPassword,
    IdentificationType? IdentificationType,
    string Document,
    DateOnly DateOfBirth,
    string Gender,
    string? PhoneNumber,
    bool AcceptPrivacy,
    bool AuthorizeData) : IRequest<Guid>;