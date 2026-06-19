using Microsoft.AspNetCore.Authorization;

namespace VirtualMed.Api.Authorization;

public class RequirePermissionAttribute : AuthorizeAttribute
{
    public RequirePermissionAttribute(string resource, string action)
        : base($"Permission:{resource}:{action}")
    {
    }
}
