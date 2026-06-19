namespace VirtualMed.Application.Interfaces.Services;

public interface ITotpService
{
    string GenerateSecret();
    string GenerateOtpAuthUri(string issuer, string accountName, string secret);
    bool ValidateCode(string secret, string code);
    IReadOnlyList<string> GenerateRecoveryCodes(int count);
}