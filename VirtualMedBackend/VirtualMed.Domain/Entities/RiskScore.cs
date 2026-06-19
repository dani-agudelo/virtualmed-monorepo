namespace VirtualMed.Domain.Entities;

/// <summary>
/// Score de riesgo cardiovascular orientativo.
/// </summary>
public class RiskScore
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    public int Score { get; set; }
    public string RiskLevel { get; set; } = null!;
    public string ModelVersion { get; set; } = null!;
    public string DisclaimerVersion { get; set; } = null!;
    public DateTime CalculatedAt { get; set; }
    public string InputSnapshot { get; set; } = null!;
}
