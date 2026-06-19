using MediatR;
using VirtualMed.Application.VideoSessions;

namespace VirtualMed.Application.Queries.VideoSessions;

public record GetVideoSessionChatHistoryQuery(
    Guid SessionId,
    int PageNumber = 1,
    int PageSize = 50) : IRequest<IReadOnlyCollection<VideoChatMessageDto>>;
