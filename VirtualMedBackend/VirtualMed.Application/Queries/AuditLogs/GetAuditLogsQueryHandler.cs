using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Interfaces;

namespace VirtualMed.Application.Queries.AuditLogs;

public class GetAuditLogsQueryHandler : IRequestHandler<GetAuditLogsQuery, AuditLogsPageDto>
{
    private readonly IApplicationDbContext _context;

    public GetAuditLogsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<AuditLogsPageDto> Handle(
        GetAuditLogsQuery request,
        CancellationToken cancellationToken)
    {
        var query = _context.Set<Domain.Entities.AuditLog>()
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.TableName))
            query = query.Where(x => x.TableName == request.TableName);

        if (!string.IsNullOrWhiteSpace(request.Operation))
            query = query.Where(x => x.Operation == request.Operation);

        if (request.From.HasValue)
            query = query.Where(x => x.OccurredAt >= request.From.Value);

        if (request.To.HasValue)
            query = query.Where(x => x.OccurredAt <= request.To.Value);

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(x => x.OccurredAt)
            .Skip(Math.Max(0, request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(x => new AuditLogItemDto
            {
                Id = x.Id,
                OccurredAt = x.OccurredAt,
                CreatedAt = x.CreatedAt,
                UpdatedAt = x.UpdatedAt,
                TableName = x.TableName,
                Operation = x.Operation,
                RowPk = x.RowPk,
                OldData = x.OldData,
                NewData = x.NewData,
                DbUser = x.DbUser,
                AppUserId = x.AppUserId
            })
            .ToListAsync(cancellationToken);

        return new AuditLogsPageDto
        {
            Items = items,
            PageNumber = request.PageNumber,
            PageSize = request.PageSize,
            TotalCount = total
        };
    }
}

