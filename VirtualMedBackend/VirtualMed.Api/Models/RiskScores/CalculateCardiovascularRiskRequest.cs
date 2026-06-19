using VirtualMed.Application.RiskScores;

namespace VirtualMed.Api.Models.RiskScores;

public class CalculateCardiovascularRiskRequest
{
    public CardiovascularRiskOverridesDto? Overrides { get; set; }
}
