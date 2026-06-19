using MediatR;
using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Application.VitalSigns;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Commands.VitalSigns;

public class SyncSimulatedVitalReadingsCommandHandler
    : IRequestHandler<SyncSimulatedVitalReadingsCommand, SyncSimulatedVitalReadingsResult>
{
    public const int MaxBulkSize = 500;

    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly IAlertEvaluationService _alertEvaluation;

    public SyncSimulatedVitalReadingsCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUser,
        IAlertEvaluationService alertEvaluation)
    {
        _context = context;
        _currentUser = currentUser;
        _alertEvaluation = alertEvaluation;
    }

    public async Task<SyncSimulatedVitalReadingsResult> Handle(
        SyncSimulatedVitalReadingsCommand request,
        CancellationToken cancellationToken)
    {
        if (request.Readings.Count == 0)
            throw new BusinessRuleException("VITAL_EMPTY_BATCH", "Debe enviar al menos una lectura.");

        if (request.Readings.Count > MaxBulkSize)
            throw new BusinessRuleException(
                "VITAL_BULK_TOO_LARGE",
                $"Máximo {MaxBulkSize} lecturas por solicitud.");

        var patientId = await ResolvePatientIdForBulkAsync(request.PatientId, cancellationToken);

        var rejected = new List<SimulatedVitalRejectionDto>();
        var accepted = new List<VitalSignReading>();
        var now = DateTime.UtcNow;

        for (var i = 0; i < request.Readings.Count; i++)
        {
            var item = request.Readings[i];
            try
            {
                if (!Enum.IsDefined(item.Type))
                    throw new BusinessRuleException("VITAL_INVALID_TYPE", "Tipo de signo vital no válido.");

                VitalSignRangeRules.ValidateValue(item.Type, item.Value);
                var unit = string.IsNullOrWhiteSpace(item.Unit)
                    ? VitalSignRangeRules.GetDefaultUnit(item.Type)
                    : item.Unit.Trim();

                var readingAt = item.ReadingAt.HasValue
                    ? DateTime.SpecifyKind(item.ReadingAt.Value, DateTimeKind.Utc)
                    : now;

                accepted.Add(new VitalSignReading
                {
                    Id = Guid.NewGuid(),
                    PatientId = patientId,
                    VitalSignType = item.Type,
                    Value = item.Value,
                    Unit = unit,
                    ReadingAt = readingAt,
                    Source = VitalReadingSource.Simulated,
                    RawPayload = string.IsNullOrWhiteSpace(item.Notes) ? null : item.Notes.Trim(),
                    CreatedAt = now
                });
            }
            catch (BusinessRuleException ex)
            {
                rejected.Add(new SimulatedVitalRejectionDto(i, ex.ErrorCode ?? "VITAL_REJECTED", ex.Message));
            }
            catch (Exception ex)
            {
                rejected.Add(new SimulatedVitalRejectionDto(i, "VITAL_REJECTED", ex.Message));
            }
        }

        foreach (var entity in accepted)
            _context.Add(entity);

        if (accepted.Count > 0)
        {
            await _context.SaveChangesAsync(cancellationToken);
            await _alertEvaluation.EvaluateReadingsAsync(patientId, accepted, cancellationToken);
        }

        var summary = accepted
            .GroupBy(r => r.VitalSignType.ToString())
            .ToDictionary(g => g.Key, g => g.Count());

        return new SyncSimulatedVitalReadingsResult(accepted.Count, rejected, summary);
    }

    private async Task<Guid> ResolvePatientIdForBulkAsync(Guid? patientIdFromRequest, CancellationToken cancellationToken)
    {
        var role = _currentUser.Role ?? string.Empty;

        if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
        {
            if (!patientIdFromRequest.HasValue)
                throw new BusinessRuleException("PATIENT_ID_REQUIRED", "Admin debe indicar patientId en la solicitud.");

            return await PatientVitalAccessResolver.ResolvePatientIdForWriteAsync(
                _context, _currentUser, patientIdFromRequest, cancellationToken);
        }

        return await PatientVitalAccessResolver.ResolvePatientIdForWriteAsync(
            _context, _currentUser, patientIdFromRequest, cancellationToken);
    }
}
