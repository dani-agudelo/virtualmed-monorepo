using VirtualMed.Application.RiskScores;

namespace VirtualMed.Application.Interfaces.Services;

public interface IRiskPredictionClient
{
    Task<RiskPredictionApiResult> PredictCardiovascularAsync(
        CardiovascularRiskApiRequest request,
        CancellationToken cancellationToken = default);

    Task<RiskPredictionHealthStatus> GetHealthAsync(CancellationToken cancellationToken = default);
}

public sealed class CardiovascularRiskApiRequest
{
    public required int Age { get; init; }
    public required int Sex { get; init; }
    public required double Bmi { get; init; }
    public required int SystolicBp { get; init; }
    public required int DiastolicBp { get; init; }
    public required int Smoker { get; init; }
    public required int PhysicalActivityLevel { get; init; }
    public int? FamilyHistoryCvd { get; init; }
    public int? CholesterolTotal { get; init; }
    public int? GlucoseMgDl { get; init; }
}

public sealed class RiskPredictionApiResult
{
    public required int Score { get; init; }
    public required string RiskLevel { get; init; }
    public required string ModelVersion { get; init; }
    public required string DisclaimerVersion { get; init; }
}

public sealed class RiskPredictionHealthStatus
{
    public required string Status { get; init; }
    public string? ModelVersion { get; init; }
}
