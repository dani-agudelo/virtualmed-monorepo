using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Patients;

public class PatientDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public IdentificationType? IdentificationType { get; set; }
    public string Document { get; set; } = null!;
    public DateOnly DateOfBirth { get; set; }
    public string Gender { get; set; } = null!;
    public string BloodType { get; set; } = string.Empty;
    public string? Allergies { get; set; }
    public string? PhoneNumber { get; set; }
    public bool AcceptPrivacy { get; set; }
    public bool AuthorizeData { get; set; }
}

