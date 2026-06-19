using Microsoft.AspNetCore.Authorization;
using VirtualMed.Infrastructure.Services;

namespace VirtualMed.Api.Authorization;

public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (context.User?.Identity?.IsAuthenticated != true)
        {
            return Task.CompletedTask;
        }

        var permissionClaims = context.User.FindAll(JwtTokenService.ClaimPermission).Select(c => c.Value).ToList();
        if (permissionClaims.Contains(requirement.PermissionKey))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
