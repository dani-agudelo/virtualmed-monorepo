using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace VirtualMed.Api.Authorization;

public class PermissionPolicyProvider : IAuthorizationPolicyProvider
{
    public const string PermissionPolicyPrefix = "Permission:";
    private readonly DefaultAuthorizationPolicyProvider _fallback;

    public PermissionPolicyProvider(IOptions<AuthorizationOptions> options)
    {
        _fallback = new DefaultAuthorizationPolicyProvider(options);
    }

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (policyName.StartsWith(PermissionPolicyPrefix, StringComparison.Ordinal))
        {
            var parts = policyName[PermissionPolicyPrefix.Length..].Split(':', 2, StringSplitOptions.None);
            if (parts.Length == 2)
            {
                var resource = parts[0];
                var action = parts[1];
                var requirement = new PermissionRequirement(resource, action);
                var policy = new AuthorizationPolicyBuilder()
                    .AddRequirements(requirement)
                    .Build();
                return Task.FromResult<AuthorizationPolicy?>(policy);
            }
        }

        return _fallback.GetPolicyAsync(policyName);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync() => _fallback.GetDefaultPolicyAsync();
    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() => _fallback.GetFallbackPolicyAsync();
}
