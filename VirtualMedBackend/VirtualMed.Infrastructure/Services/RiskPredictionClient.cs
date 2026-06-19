using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.Configuration;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Application.RiskScores;

namespace VirtualMed.Infrastructure.Services;

public class RiskPredictionClient : IRiskPredictionClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly HttpClient _httpClient;

    public RiskPredictionClient(HttpClient httpClient, IOptions<RiskPredictionSettings> settings)
    {
        _httpClient = httpClient;
        var baseUrl = settings.Value.BaseUrl.TrimEnd('/') + "/";
        _httpClient.BaseAddress = new Uri(baseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(settings.Value.TimeoutSeconds);
    }

    public async Task<RiskPredictionHealthStatus> GetHealthAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync("health", cancellationToken);
            if (!response.IsSuccessStatusCode)
                return new RiskPredictionHealthStatus { Status = "unavailable" };

            var body = await response.Content.ReadFromJsonAsync<HealthResponseDto>(JsonOptions, cancellationToken);
            return new RiskPredictionHealthStatus
            {
                Status = body?.Status ?? "unavailable",
                ModelVersion = body?.ModelVersion
            };
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            throw new ExternalServiceException(
                "No se pudo contactar el servicio de predicción de riesgo.",
                "RiskPrediction");
        }
    }

    public async Task<RiskPredictionApiResult> PredictCardiovascularAsync(
        CardiovascularRiskApiRequest request,
        CancellationToken cancellationToken = default)
    {
        HttpResponseMessage response;
        try
        {
            response = await _httpClient.PostAsJsonAsync(
                "predict/cardiovascular",
                request,
                JsonOptions,
                cancellationToken);
        }
        catch (TaskCanceledException)
        {
            throw new ExternalServiceException(
                "El servicio de predicción tardó demasiado en responder.",
                "RiskPrediction");
        }
        catch (HttpRequestException ex)
        {
            throw new ExternalServiceException(
                "No se pudo contactar el servicio de predicción de riesgo.",
                ex);
        }

        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (response.StatusCode == HttpStatusCode.UnprocessableEntity)
            throw new BusinessRuleException(
                "RISK_PREDICTION_VALIDATION",
                $"Datos inválidos para el modelo: {ExtractDetail(body)}");

        if (response.StatusCode == HttpStatusCode.ServiceUnavailable)
            throw new ExternalServiceException(
                "El servicio de predicción no tiene el modelo disponible.",
                "RiskPrediction");

        if (!response.IsSuccessStatusCode)
            throw new ExternalServiceException(
                $"El servicio de predicción respondió con error ({(int)response.StatusCode}).",
                "RiskPrediction");

        var result = JsonSerializer.Deserialize<RiskPredictionResponseDto>(body, JsonOptions);
        if (result is null)
            throw new ExternalServiceException("Respuesta vacía del servicio de predicción.", "RiskPrediction");

        return new RiskPredictionApiResult
        {
            Score = result.Score,
            RiskLevel = result.RiskLevel,
            ModelVersion = result.ModelVersion,
            DisclaimerVersion = result.DisclaimerVersion
        };
    }

    private static string ExtractDetail(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("detail", out var detail))
            {
                return detail.ValueKind switch
                {
                    JsonValueKind.String => detail.GetString() ?? body,
                    JsonValueKind.Array => string.Join("; ", detail.EnumerateArray()
                        .Select(e => e.GetRawText())),
                    _ => detail.GetRawText()
                };
            }
        }
        catch
        {
            // ignore parse errors
        }

        return string.IsNullOrWhiteSpace(body) ? "sin detalle" : body;
    }

    private sealed class HealthResponseDto
    {
        public string Status { get; set; } = "";
        public string? ModelVersion { get; set; }
    }

    private sealed class RiskPredictionResponseDto
    {
        public int Score { get; set; }
        public string RiskLevel { get; set; } = "";
        public string ModelVersion { get; set; } = "";
        public string DisclaimerVersion { get; set; } = "";
    }
}
