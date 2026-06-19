namespace VirtualMed.Domain.Entities;

public class TwoFactorAuth
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string SecretKeyEncrypted { get; set; } = null!;
    public string RecoveryCodesEncrypted { get; set; } = null!;

    public bool IsEnabled { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

