using MediatR;

namespace VirtualMed.Application.Queries.Appointments;

public record ListAppointmentsQuery(
    Guid? PatientId,
    Guid? DoctorId,
    DateTime? From,
    DateTime? To) : IRequest<IReadOnlyCollection<AppointmentDto>>;
