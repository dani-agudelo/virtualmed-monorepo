namespace VirtualMed.Application.Queries.Users;

public record UserListItemDto(
    Guid Id,
    string FullName,
    string Email,
    string Status,
    Guid RoleId,
    string RoleName,
    bool EmailVerified,
    bool TwoFactorEnabled,
    DateTime CreatedAt,
    DateTime? LastLoginAt,
    Guid? DoctorId);
