using VirtualMed.Application.Interfaces.Services;

namespace VirtualMed.Infrastructure.Services;

public class PasswordHasher : IPasswordHasher
{
    private const int BcryptCostFactor = 12;

    public string Hash(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password, BcryptCostFactor);
    }

    public bool Verify(string password, string passwordHash)
    {
        return BCrypt.Net.BCrypt.Verify(password, passwordHash);
    }
}
