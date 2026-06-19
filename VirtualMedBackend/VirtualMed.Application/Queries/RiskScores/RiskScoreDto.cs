namespace VirtualMed.Application.Queries.RiskScores;

public class RiskScoreDto
{
    public Guid Id { get; init; }
    public Guid PatientId { get; init; }
    public int Score { get; init; }
    public string RiskLevel { get; init; } = null!;
    public string ModelVersion { get; init; } = null!;
    public string DisclaimerVersion { get; init; } = null!;
    public DateTime CalculatedAt { get; init; }
}
