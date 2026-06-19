using MediatR;
using VirtualMed.Application.VideoSessions;

namespace VirtualMed.Application.Commands.VideoSessions;

public record CreateVideoSessionCommand(Guid AppointmentId) : IRequest<VideoSessionDto>;
