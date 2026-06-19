namespace VirtualMed.Application.Auth;

public record UserTokenInfo(
    Guid Id,
    string Email,
    string FullName,
    string RoleName,
    string Status,
    bool EmailVerified,
    bool TwoFactorEnabled
);
