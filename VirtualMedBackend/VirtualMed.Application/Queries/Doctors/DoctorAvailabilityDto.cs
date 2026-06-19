namespace VirtualMed.Application.Queries.Doctors;

public sealed class DoctorAvailabilityDto
{
    public required Guid DoctorId { get; init; }
    public required int AppointmentDurationMinutes { get; init; }
    public required IReadOnlyList<DateTime> AvailableSlotsUtc { get; init; }
}
