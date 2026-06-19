using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.VideoSessions;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Queries.VideoSessions;

public class GetVideoSessionChatHistoryQueryHandler : IRequestHandler<GetVideoSessionChatHistoryQuery, IReadOnlyCollection<VideoChatMessageDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public GetVideoSessionChatHistoryQueryHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<IReadOnlyCollection<VideoChatMessageDto>> Handle(GetVideoSessionChatHistoryQuery request, CancellationToken cancellationToken)
    {
        var session = await _context.Set<VideoSession>()
            .AsNoTracking()
            .Include(v => v.Appointment)
            .FirstOrDefaultAsync(v => v.SessionId == request.SessionId, cancellationToken)
            ?? throw new NotFoundException("VideoSession", request.SessionId);

        var (userId, role) = await VideoSessionAccessHelper.ResolveCurrentUserAsync(_currentUserService);
        await VideoSessionAccessHelper.EnsureCanAccessSessionAsync(
            _context, userId, role, session, cancellationToken);

        var page = request.PageNumber <= 0 ? 1 : request.PageNumber;
        var pageSize = request.PageSize <= 0 ? 50 : Math.Min(request.PageSize, 200);

        var messages = await _context.Set<VideoChatMessage>()
            .AsNoTracking()
            .Where(x => x.VideoSessionId == session.Id)
            .OrderByDescending(x => x.SentAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new VideoChatMessageDto
            {
                Id = x.Id,
                VideoSessionId = session.SessionId,
                SenderId = x.SenderId,
                Message = x.Message,
                SentAt = x.SentAt,
                MessageType = x.MessageType
            })
            .ToListAsync(cancellationToken);

        return messages
            .OrderBy(x => x.SentAt)
            .ToList();
    }
}
