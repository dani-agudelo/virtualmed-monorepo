using MediatR;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.VitalSigns;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Commands.VitalSigns;

public class RecordVitalSignReadingCommandHandler : IRequestHandler<RecordVitalSignReadingCommand, RecordVitalSignReadingResult>
{
    private const int MaxBatchSize = 20;

    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly IAlertEvaluationService _alertEvaluation;

    public RecordVitalSignReadingCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUser,
        IAlertEvaluationService alertEvaluation)
    {
        _context = context;
        _currentUser = currentUser;
        _alertEvaluation = alertEvaluation;
    }

    public async Task<RecordVitalSignReadingResult> Handle(
        RecordVitalSignReadingCommand request,
        CancellationToken cancellationToken)
    {
        if (request.Readings.Count == 0)
            throw new Common.Exceptions.BusinessRuleException("VITAL_EMPTY_BATCH", "Debe enviar al menos una lectura.");

        if (request.Readings.Count > MaxBatchSize)
            throw new Common.Exceptions.BusinessRuleException(
                "VITAL_BATCH_TOO_LARGE",
                $"Máximo {MaxBatchSize} lecturas por solicitud.");

        var patientId = await PatientVitalAccessResolver.ResolvePatientIdForWriteAsync(
            _context,
            _currentUser,
            request.PatientId,
            cancellationToken);

        var now = DateTime.UtcNow;
        var entities = new List<VitalSignReading>();

        foreach (var item in request.Readings)
        {
            VitalSignRangeRules.ValidateValue(item.Type, item.Value);
            var unit = string.IsNullOrWhiteSpace(item.Unit)
                ? VitalSignRangeRules.GetDefaultUnit(item.Type)
                : item.Unit.Trim();

            var readingAt = item.ReadingAt.HasValue
                ? DateTime.SpecifyKind(item.ReadingAt.Value, DateTimeKind.Utc)
                : now;

            entities.Add(new VitalSignReading
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                VitalSignType = item.Type,
                Value = item.Value,
                Unit = unit,
                ReadingAt = readingAt,
                Source = VitalReadingSource.Manual,
                RawPayload = string.IsNullOrWhiteSpace(item.Notes) ? null : item.Notes.Trim(),
                CreatedAt = now
            });
        }

        foreach (var entity in entities)
            _context.Add(entity);

        await _context.SaveChangesAsync(cancellationToken);
        await _alertEvaluation.EvaluateReadingsAsync(patientId, entities, cancellationToken);

        return new RecordVitalSignReadingResult(entities.Count, entities.Select(e => e.Id).ToList());
    }
}
