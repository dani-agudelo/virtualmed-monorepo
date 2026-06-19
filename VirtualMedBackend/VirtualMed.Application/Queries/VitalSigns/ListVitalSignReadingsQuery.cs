using MediatR;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Queries.VitalSigns;

public record ListVitalSignReadingsQuery(
    Guid? PatientId,
    DateTime? FromUtc,
    DateTime? ToUtc,
    IReadOnlyList<VitalSignType>? Types,
    VitalReadingSource? Source,
    int Page = 1,
    int PageSize = 50,
    bool IncludeSummary = false) : IRequest<VitalSignReadingsListResult>;
