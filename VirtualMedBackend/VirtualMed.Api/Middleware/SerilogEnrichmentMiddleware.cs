using Serilog.Context;

namespace VirtualMed.Api.Middleware;


public class SerilogEnrichmentMiddleware
{
    private readonly RequestDelegate _next;

    public SerilogEnrichmentMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var traceId = context.TraceIdentifier;
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var userId = context.User?.FindFirst("sub")?.Value
            ?? "";

        using (LogContext.PushProperty("TraceId", traceId))
        using (LogContext.PushProperty("ClientIp", ip))
        using (LogContext.PushProperty("UserId", userId))
        {
            await _next(context);
        }
    }
}
