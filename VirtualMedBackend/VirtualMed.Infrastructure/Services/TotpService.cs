using Microsoft.Extensions.Logging;
using OtpNet;
using VirtualMed.Application.Interfaces.Services;

namespace VirtualMed.Infrastructure.Services;

public class TotpService : ITotpService
{
    private readonly ILogger<TotpService> _logger;

    public TotpService(ILogger<TotpService> logger)
    {
        _logger = logger;
    }

    public string GenerateSecret()
    {
        var key = KeyGeneration.GenerateRandomKey(20);
        return Base32Encoding.ToString(key);
    }

    public string GenerateOtpAuthUri(string issuer, string accountName, string secret)
    {
        var label = Uri.EscapeDataString($"{issuer}:{accountName}");
        var issuerEncoded = Uri.EscapeDataString(issuer);
        var secretEncoded = Uri.EscapeDataString(secret);

        return $"otpauth://totp/{label}?secret={secretEncoded}&issuer={issuerEncoded}&digits=6&period=30";
    }

    public bool ValidateCode(string secret, string code)
    {
        try
        {
            var secretBytes = Base32Encoding.ToBytes(secret);
            var totp = new Totp(secretBytes, step: 30, mode: OtpHashMode.Sha1, totpSize: 6);

            return totp.VerifyTotp(code, out _, new VerificationWindow(previous: 1, future: 1));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating TOTP code.");
            return false;
        }
    }

    public IReadOnlyList<string> GenerateRecoveryCodes(int count)
    {
        var codes = new List<string>(count);
        for (int i = 0; i < count; i++)
        {
            var bytes = KeyGeneration.GenerateRandomKey(6);
            var code = BitConverter.ToString(bytes).Replace("-", string.Empty)[..12];
            codes.Add($"{code[..4]}-{code[4..8]}-{code[8..12]}");
        }

        return codes;
    }
}