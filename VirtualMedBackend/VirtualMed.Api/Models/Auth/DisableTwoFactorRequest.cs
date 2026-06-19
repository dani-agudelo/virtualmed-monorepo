namespace VirtualMed.Api.Models.Auth;

public class DisableTwoFactorRequest
{
    public string RecoveryCode { get; set; } = default!;
}

