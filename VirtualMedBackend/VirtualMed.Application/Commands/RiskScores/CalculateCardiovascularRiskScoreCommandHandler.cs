using MediatR;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Application.Queries.RiskScores;
using VirtualMed.Application.RiskScores;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.RiskScores;

public class CalculateCardiovascularRiskScoreCommandHandler
    : IRequestHandler<CalculateCardiovascularRiskScoreCommand, RiskScoreDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly ICardiovascularRiskFeatureAssembler _featureAssembler;
    private readonly IRiskPredictionClient _riskPredictionClient;

    public CalculateCardiovascularRiskScoreCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUser,
        ICardiovascularRiskFeatureAssembler featureAssembler,
        IRiskPredictionClient riskPredictionClient)
    {
        _context = context;
        _currentUser = currentUser;
        _featureAssembler = featureAssembler;
        _riskPredictionClient = riskPredictionClient;
    }

    public async Task<RiskScoreDto> Handle(
        CalculateCardiovascularRiskScoreCommand request,
        CancellationToken cancellationToken)
    {
        var patientId = await PatientRiskScoreAccessResolver.ResolvePatientIdForCalculateAsync(
            _context,
            _currentUser,
            request.PatientId,
            cancellationToken);

        var health = await _riskPredictionClient.GetHealthAsync(cancellationToken);
        if (!string.Equals(health.Status, "ok", StringComparison.OrdinalIgnoreCase))
            throw new Common.Exceptions.ExternalServiceException(
                "El servicio de predicción de riesgo no está disponible.",
                "RiskPrediction");

        var (apiRequest, inputSnapshot) = await _featureAssembler.AssembleAsync(
            patientId,
            request.Overrides,
            cancellationToken);

        var prediction = await _riskPredictionClient.PredictCardiovascularAsync(apiRequest, cancellationToken);

        var now = DateTime.UtcNow;
        var entity = new RiskScore
        {
            Id = Guid.NewGuid(),
            PatientId = patientId,
            Score = prediction.Score,
            RiskLevel = prediction.RiskLevel,
            ModelVersion = prediction.ModelVersion,
            DisclaimerVersion = prediction.DisclaimerVersion,
            CalculatedAt = now,
            InputSnapshot = inputSnapshot
        };

        _context.Add(entity);
        await _context.SaveChangesAsync(cancellationToken);

        return MapToDto(entity);
    }

    private static RiskScoreDto MapToDto(RiskScore entity) => new()
    {
        Id = entity.Id,
        PatientId = entity.PatientId,
        Score = entity.Score,
        RiskLevel = entity.RiskLevel,
        ModelVersion = entity.ModelVersion,
        DisclaimerVersion = entity.DisclaimerVersion,
        CalculatedAt = entity.CalculatedAt
    };
}
