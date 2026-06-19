using MediatR;

namespace VirtualMed.Application.Queries.VitalSigns;

public record ListHealthAlertsQuery(
    Guid? PatientId,
    bool? UnreadOnly,
    int Page = 1,
    int PageSize = 50) : IRequest<Common.Models.PagedResult<HealthAlertDto>>;
