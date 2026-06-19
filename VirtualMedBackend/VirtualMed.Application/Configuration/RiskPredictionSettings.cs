namespace VirtualMed.Application.Configuration;

public class RiskPredictionSettings
{
    public string BaseUrl { get; set; } = "http://localhost:8000";
    public int TimeoutSeconds { get; set; } = 10;
}
