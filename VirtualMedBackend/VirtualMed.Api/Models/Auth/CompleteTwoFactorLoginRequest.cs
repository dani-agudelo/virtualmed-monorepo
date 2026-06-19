namespace VirtualMed.Api.Models.Auth;

public class CompleteTwoFactorLoginRequest
{
    public string TempTwoFactorToken { get; set; } = default!;
    public string Code { get; set; } = default!;
}
