using MediatR;

namespace VirtualMed.Application.Queries.Doctors;

public record GetDoctorAvailabilityQuery(
    Guid DoctorId,
    DateTime FromUtc,
    DateTime ToUtc,
    int SlotStepMinutes,
    int AppointmentDurationMinutes) : IRequest<DoctorAvailabilityDto>;
