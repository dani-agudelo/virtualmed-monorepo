using System.Text;
using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Interfaces;

namespace VirtualMed.Application.Queries.AuditLogs;

public class ExportAuditLogsQueryHandler : IRequestHandler<ExportAuditLogsQuery, string>
{
    private readonly IApplicationDbContext _context;

    public ExportAuditLogsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<string> Handle(
        ExportAuditLogsQuery request,
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

        var rows = await query
            .OrderByDescending(x => x.OccurredAt)
            .Take(Math.Max(1, request.MaxRows))
            .Select(x => new
            {
                x.OccurredAt,
                x.TableName,
                x.Operation,
                x.RowPk,
                x.OldData,
                x.NewData,
                x.DbUser,
                x.AppUserId
            })
            .ToListAsync(cancellationToken);

        var sb = new StringBuilder();
        sb.AppendLine("OccurredAt,TableName,Operation,RowPk,AppUserId,DbUser,OldData,NewData");

        foreach (var r in rows)
        {
            sb.AppendLine(
                string.Join(",",
                    Csv(r.OccurredAt.ToString("O")),
                    Csv(r.TableName),
                    Csv(r.Operation),
                    Csv(r.RowPk),
                    Csv(r.AppUserId),
                    Csv(r.DbUser),
                    Csv(r.OldData),
                    Csv(r.NewData)));
        }

        return sb.ToString();
    }

    private static string Csv(string? value)
    {
        if (value == null) return "\"\"";
        var escaped = value.Replace("\"", "\"\"");
        return $"\"{escaped}\"";
    }
}

