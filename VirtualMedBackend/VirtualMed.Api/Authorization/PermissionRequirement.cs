using Microsoft.AspNetCore.Authorization;

namespace VirtualMed.Api.Authorization;

public class PermissionRequirement : IAuthorizationRequirement
{
    public string Resource { get; }
    public string Action { get; }

    public PermissionRequirement(string resource, string action)
    {
        Resource = resource;
        Action = action;
    }

    public string PermissionKey => $"{Resource}:{Action}";
}
