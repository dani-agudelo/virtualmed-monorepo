using MediatR;
using VirtualMed.Application.VideoSessions;

namespace VirtualMed.Application.Queries.VideoSessions;

public record GetVideoSessionByIdQuery(Guid SessionId) : IRequest<VideoSessionDto>;
