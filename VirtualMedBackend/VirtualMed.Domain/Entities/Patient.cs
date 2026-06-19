using VirtualMed.Domain.Enums;

namespace VirtualMed.Domain.Entities;

public class Patient
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public IdentificationType? IdentificationType { get; set; }
    public string Document { get; set; } = null!;
    public DateOnly DateOfBirth { get; set; }
    public string BloodType { get; set; } = string.Empty;
    public string Gender { get; set; } = null!;
    public string Allergies { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public bool AcceptPrivacy { get; set; }
    public bool AuthorizeData { get; set; }
}

