using MediatR;

namespace VirtualMed.Application.Queries.AuditLogs;

public record GetAuditLogsQuery(
    string? TableName,
    string? Operation,
    DateTime? From,
    DateTime? To,
    int PageNumber,
    int PageSize) : IRequest<AuditLogsPageDto>;

