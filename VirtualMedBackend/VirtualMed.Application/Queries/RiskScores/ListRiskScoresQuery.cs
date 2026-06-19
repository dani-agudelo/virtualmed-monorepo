using MediatR;
using VirtualMed.Application.Common.Models;

namespace VirtualMed.Application.Queries.RiskScores;

public record ListRiskScoresQuery(
    Guid? PatientId,
    int Page = 1,
    int PageSize = 20) : IRequest<PagedResult<RiskScoreDto>>;
