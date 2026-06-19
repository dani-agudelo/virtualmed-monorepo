using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.VideoSessions;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Queries.VideoSessions;

public class GetVideoSessionByIdQueryHandler : IRequestHandler<GetVideoSessionByIdQuery, VideoSessionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public GetVideoSessionByIdQueryHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<VideoSessionDto> Handle(GetVideoSessionByIdQuery request, CancellationToken cancellationToken)
    {
        var session = await _context.Set<VideoSession>()
            .AsNoTracking()
            .Include(v => v.Appointment)
            .FirstOrDefaultAsync(v => v.SessionId == request.SessionId, cancellationToken)
            ?? throw new NotFoundException("VideoSession", request.SessionId);

        var (userId, role) = await VideoSessionAccessHelper.ResolveCurrentUserAsync(_currentUserService);
        await VideoSessionAccessHelper.EnsureCanAccessSessionAsync(
            _context, userId, role, session, cancellationToken);

        if (session.Status != VideoSessionStatus.Ended && session.TokenExpiresAt <= DateTime.UtcNow)
            session.Status = VideoSessionStatus.Expired;

        return VideoSessionMapper.ToDto(session);
    }
}
