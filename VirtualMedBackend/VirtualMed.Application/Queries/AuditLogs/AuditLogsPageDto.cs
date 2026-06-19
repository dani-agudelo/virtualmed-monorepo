namespace VirtualMed.Application.Queries.AuditLogs;

public class AuditLogsPageDto
{
    public IReadOnlyList<AuditLogItemDto> Items { get; set; } = Array.Empty<AuditLogItemDto>();
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}

