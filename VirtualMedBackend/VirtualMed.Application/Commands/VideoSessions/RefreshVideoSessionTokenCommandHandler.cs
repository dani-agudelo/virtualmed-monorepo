using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Application.VideoSessions;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;
using AppInvalidOperationException = VirtualMed.Application.Exceptions.InvalidOperationException;

namespace VirtualMed.Application.Commands.VideoSessions;

public class RefreshVideoSessionTokenCommandHandler : IRequestHandler<RefreshVideoSessionTokenCommand, IceCredentialsDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IWebRtcIceService _webRtcIceService;

    public RefreshVideoSessionTokenCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IWebRtcIceService webRtcIceService)
    {
        _context = context;
        _currentUserService = currentUserService;
        _webRtcIceService = webRtcIceService;
    }

    public async Task<IceCredentialsDto> Handle(RefreshVideoSessionTokenCommand request, CancellationToken cancellationToken)
    {
        var session = await _context.Set<VideoSession>()
            .Include(v => v.Appointment)
            .FirstOrDefaultAsync(v => v.SessionId == request.SessionId, cancellationToken)
            ?? throw new NotFoundException("VideoSession", request.SessionId);

        var (userId, role) = await VideoSessionAccessHelper.ResolveCurrentUserAsync(_currentUserService);
        await VideoSessionAccessHelper.EnsureCanAccessSessionAsync(
            _context, userId, role, session, cancellationToken);

        if (session.Status == VideoSessionStatus.Ended)
            throw new AppInvalidOperationException("No puede refrescar token de una sesión finalizada.");

        var now = DateTime.UtcNow;
        session.RoomToken = Guid.NewGuid().ToString("N");
        session.TokenExpiresAt = now.AddMinutes(60);
        session.Status = session.Status == VideoSessionStatus.Expired ? VideoSessionStatus.Created : session.Status;
        session.UpdatedAt = now;

        _context.Update(session);
        await _context.SaveChangesAsync(cancellationToken);

        var iceServers = await _webRtcIceService.GenerateIceServersAsync(60 * 60, cancellationToken);

        return new IceCredentialsDto
        {
            SessionId = session.SessionId,
            RoomToken = session.RoomToken,
            TokenExpiresAt = session.TokenExpiresAt,
            IceServers = iceServers
        };
    }
}
