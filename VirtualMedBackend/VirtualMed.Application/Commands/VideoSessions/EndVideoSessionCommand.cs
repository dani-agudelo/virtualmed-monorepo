using MediatR;
using VirtualMed.Application.VideoSessions;

namespace VirtualMed.Application.Commands.VideoSessions;

public record EndVideoSessionCommand(Guid SessionId, string? EndReason) : IRequest<VideoSessionDto>;
