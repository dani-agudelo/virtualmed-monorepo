using MediatR;
using VirtualMed.Application.VideoSessions;

namespace VirtualMed.Application.Commands.VideoSessions;

public record StartVideoSessionCommand(Guid SessionId) : IRequest<VideoSessionDto>;
