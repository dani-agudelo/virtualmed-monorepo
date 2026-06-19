using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Common.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Queries.Doctors;

internal static class DoctorAvailabilityComputation
{
    internal const int MinSlotStepMinutes = 5;
    internal const int MaxSlotStepMinutes = 120;
    internal const int MaxWindowDays = 31;

    internal static DateTime NormalizeUtc(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

    internal static (DateTime FromUtc, DateTime ToUtc) ValidateRangeAndParameters(
        DateTime fromUtcRaw,
        DateTime toUtcRaw,
        int slotStepMinutes,
        int appointmentDurationMinutes)
    {
        var fromUtc = NormalizeUtc(fromUtcRaw);
        var toUtc = NormalizeUtc(toUtcRaw);

        if (fromUtc >= toUtc)
            throw new BusinessRuleException("AVAILABILITY_INVALID_RANGE", "fromUtc debe ser anterior a toUtc.");

        if (toUtc - fromUtc > TimeSpan.FromDays(MaxWindowDays))
            throw new BusinessRuleException("AVAILABILITY_RANGE_TOO_LARGE", $"El rango no puede superar {MaxWindowDays} días.");

        if (slotStepMinutes is < MinSlotStepMinutes or > MaxSlotStepMinutes)
            throw new BusinessRuleException(
                "AVAILABILITY_INVALID_STEP",
                $"slotStepMinutes debe estar entre {MinSlotStepMinutes} y {MaxSlotStepMinutes}.");

        if (appointmentDurationMinutes is < 1 or > 24 * 60)
            throw new BusinessRuleException("AVAILABILITY_INVALID_DURATION", "appointmentDurationMinutes debe estar entre 1 y 1440.");

        return (fromUtc, toUtc);
    }

    internal static async Task<DoctorAvailabilityDto> ComputeAsync(
        IApplicationDbContext context,
        Guid doctorId,
        DateTime fromUtc,
        DateTime toUtc,
        int slotStepMinutes,
        int appointmentDurationMinutes,
        CancellationToken cancellationToken)
    {
        var doctorExists = await context.Set<Doctor>()
            .AsNoTracking()
            .AnyAsync(d => d.Id == doctorId, cancellationToken);

        if (!doctorExists)
            throw new BusinessRuleException("DOCTOR_NOT_FOUND", "Médico no encontrado.");

        var now = DateTime.UtcNow;
        var minBookableStart = now.AddHours(12);

        var busy = await context.Set<Appointment>()
            .AsNoTracking()
            .Where(a => a.DoctorId == doctorId
                        && a.Status != AppointmentStatus.Cancelled
                        && a.Status != AppointmentStatus.NoShow
                        && a.ScheduledAt < toUtc
                        && a.ScheduledAt.AddMinutes(a.DurationMinutes) > fromUtc)
            .Select(a => new { a.ScheduledAt, a.DurationMinutes })
            .ToListAsync(cancellationToken);

        var lastStart = toUtc.AddMinutes(-appointmentDurationMinutes);
        if (lastStart < fromUtc)
        {
            return new DoctorAvailabilityDto
            {
                DoctorId = doctorId,
                AppointmentDurationMinutes = appointmentDurationMinutes,
                AvailableSlotsUtc = Array.Empty<DateTime>()
            };
        }

        var slots = new List<DateTime>();
        for (var start = fromUtc; start <= lastStart; start = start.AddMinutes(slotStepMinutes))
        {
            if (start < minBookableStart)
                continue;

            var end = start.AddMinutes(appointmentDurationMinutes);
            var conflicts = false;
            foreach (var a in busy)
            {
                var aEnd = a.ScheduledAt.AddMinutes(a.DurationMinutes);
                if (a.ScheduledAt < end && aEnd > start)
                {
                    conflicts = true;
                    break;
                }
            }

            if (!conflicts)
                slots.Add(start);
        }

        return new DoctorAvailabilityDto
        {
            DoctorId = doctorId,
            AppointmentDurationMinutes = appointmentDurationMinutes,
            AvailableSlotsUtc = slots
        };
    }
}
