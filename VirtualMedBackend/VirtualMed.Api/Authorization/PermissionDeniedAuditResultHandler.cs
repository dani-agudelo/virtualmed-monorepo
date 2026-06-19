using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;

namespace VirtualMed.Api.Authorization;

public sealed class PermissionDeniedAuditResultHandler : IAuthorizationMiddlewareResultHandler
{
    private readonly AuthorizationMiddlewareResultHandler _defaultHandler = new();
    private readonly ILogger<PermissionDeniedAuditResultHandler> _logger;

    public PermissionDeniedAuditResultHandler(ILogger<PermissionDeniedAuditResultHandler> logger)
    {
        _logger = logger;
    }

    public async Task HandleAsync(
        RequestDelegate next,
        HttpContext context,
        AuthorizationPolicy policy,
        PolicyAuthorizationResult authorizeResult)
    {
        if (!authorizeResult.Succeeded
            && context.User.Identity?.IsAuthenticated == true
            && authorizeResult.AuthorizationFailure != null)
        {
            foreach (var requirement in authorizeResult.AuthorizationFailure.FailedRequirements.OfType<PermissionRequirement>())
            {
                var userId = context.User.FindFirst("sub")?.Value
                             ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                             ?? "unknown";

                _logger.LogWarning(
                    "RBAC acceso denegado. UserId={UserId}, PermisoRequerido={Permission}, Metodo={Method}, Ruta={Path}",
                    userId,
                    requirement.PermissionKey,
                    context.Request.Method,
                    context.Request.Path.Value);
            }
        }

        await _defaultHandler.HandleAsync(next, context, policy, authorizeResult);
    }
}
