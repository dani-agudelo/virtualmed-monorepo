using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Security.Claims;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;

namespace VirtualMed.Infrastructure.Persistence.Interceptors;

public sealed class AuditUserIdSaveChangesInterceptor : SaveChangesInterceptor
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<AuditUserIdSaveChangesInterceptor>? _logger;

    private sealed class State
    {
        public IDbContextTransaction? Transaction { get; set; }
        public bool StartedHere { get; set; }
    }

    private readonly ConditionalWeakTable<DbContext, State> _states = new();

    public AuditUserIdSaveChangesInterceptor(
        IHttpContextAccessor httpContextAccessor,
        ILogger<AuditUserIdSaveChangesInterceptor>? logger = null)
    {
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    private string? GetAppUserId()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        var sub = user?.FindFirst("sub")?.Value;
        if (!string.IsNullOrWhiteSpace(sub)) return sub;

        var nameId = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrWhiteSpace(nameId)) return nameId;

        return null;
    }

    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        var context = eventData.Context;
        if (context == null)
            return await base.SavingChangesAsync(eventData, result, cancellationToken);

        var appUserId = GetAppUserId();
        if (string.IsNullOrWhiteSpace(appUserId))
            return await base.SavingChangesAsync(eventData, result, cancellationToken);

        var db = context.Database;

        if (db.CurrentTransaction == null)
        {
            var tx = await db.BeginTransactionAsync(cancellationToken);
            var state = _states.TryGetValue(context, out var existing)
                ? existing
                : new State();

            if (!_states.TryGetValue(context, out existing))
                _states.Add(context, state);

            state.Transaction = tx;
            state.StartedHere = true;

            try
            {
                await db.ExecuteSqlRawAsync(
                    "SELECT set_config('app.user_id', {0}, true);",
                    new object?[] { appUserId },
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to set app.user_id in PostgreSQL (audit context).");
            }
        }
        else
        {
            try
            {
                await db.ExecuteSqlRawAsync(
                    "SELECT set_config('app.user_id', {0}, true);",
                    new object?[] { appUserId },
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to set app.user_id in PostgreSQL (audit context).");
            }
        }

        return await base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        var context = eventData.Context;
        if (context == null)
            return result;

        if (_states.TryGetValue(context, out var state) && state.StartedHere && state.Transaction != null)
        {
            try
            {
                await state.Transaction.CommitAsync(cancellationToken);
            }
            finally
            {
                await state.Transaction.DisposeAsync();
                state.Transaction = null;
                state.StartedHere = false;
            }
        }

        return result;
    }
}

