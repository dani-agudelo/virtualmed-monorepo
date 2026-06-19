using MediatR;

namespace VirtualMed.Application.Queries.AuditLogs;

public record ExportAuditLogsQuery(
    string? TableName,
    string? Operation,
    DateTime? From,
    DateTime? To,
    int MaxRows) : IRequest<string>;

