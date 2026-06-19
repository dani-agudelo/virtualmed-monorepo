using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Infrastructure.Services;

public class AlertEvaluationService : IAlertEvaluationService
{
    private static readonly TimeSpan DuplicateWindow = TimeSpan.FromHours(1);

    private readonly IApplicationDbContext _context;

    public AlertEvaluationService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task EvaluateReadingsAsync(
        Guid patientId,
        IReadOnlyList<VitalSignReading> readings,
        CancellationToken cancellationToken = default)
    {
        if (readings.Count == 0)
            return;

        var types = readings.Select(r => r.VitalSignType).Distinct().ToList();
        var thresholds = await _context.Set<AlertThreshold>()
            .AsNoTracking()
            .Where(t => t.PatientId == patientId && t.IsActive && types.Contains(t.VitalSignType))
            .ToListAsync(cancellationToken);

        if (thresholds.Count == 0)
            return;

        var now = DateTime.UtcNow;
        var windowStart = now - DuplicateWindow;

        foreach (var reading in readings)
        {
            var threshold = thresholds.FirstOrDefault(t => t.VitalSignType == reading.VitalSignType);
            if (threshold is null)
                continue;

            var isBelow = reading.Value < threshold.MinValue;
            var isAbove = reading.Value > threshold.MaxValue;
            if (!isBelow && !isAbove)
                continue;

            var alertType = $"Threshold:{reading.VitalSignType}:{(isBelow ? "Low" : "High")}";
            var duplicate = await _context.Set<HealthAlert>()
                .AsNoTracking()
                .AnyAsync(
                    a => a.PatientId == patientId
                         && a.AlertType == alertType
                         && a.OccurredAt >= windowStart,
                    cancellationToken);

            if (duplicate)
                continue;

            var severity = threshold.AlertLevel switch
            {
                AlertLevel.High => AlertSeverity.Critical,
                AlertLevel.Medium => AlertSeverity.Warning,
                _ => AlertSeverity.Info
            };

            var direction = isBelow ? "por debajo" : "por encima";
            var alert = new HealthAlert
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                VitalSignReadingId = reading.Id,
                AlertType = alertType,
                Message = $"{reading.VitalSignType} {direction} del umbral ({reading.Value} {reading.Unit}).",
                Severity = severity,
                IsRead = false,
                OccurredAt = now
            };

            _context.Add(alert);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
