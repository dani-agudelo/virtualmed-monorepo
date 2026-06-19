namespace VirtualMed.Api.Models.Auth;

public class VerifyTwoFactorRequest
{
    public string Code { get; set; } = default!;
}

