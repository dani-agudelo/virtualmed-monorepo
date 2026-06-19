using MediatR;
using VirtualMed.Application.Queries.RiskScores;
using VirtualMed.Application.RiskScores;

namespace VirtualMed.Application.Commands.RiskScores;

public record CalculateCardiovascularRiskScoreCommand(
    Guid? PatientId,
    CardiovascularRiskOverridesDto? Overrides) : IRequest<RiskScoreDto>;
