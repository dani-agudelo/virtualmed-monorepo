using MediatR;

namespace VirtualMed.Application.Queries.Doctors;

public record GetMyDoctorAvailabilityQuery(
    DateTime FromUtc,
    DateTime ToUtc,
    int SlotStepMinutes,
    int AppointmentDurationMinutes) : IRequest<DoctorAvailabilityDto>;
