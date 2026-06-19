using MediatR;

namespace VirtualMed.Application.Queries.Appointments;

public record GetAppointmentByIdQuery(Guid Id) : IRequest<AppointmentDto?>;
