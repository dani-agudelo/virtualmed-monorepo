using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.VideoSessions;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Commands.VideoSessions;

public class EndVideoSessionCommandHandler : IRequestHandler<EndVideoSessionCommand, VideoSessionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public EndVideoSessionCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<VideoSessionDto> Handle(EndVideoSessionCommand request, CancellationToken cancellationToken)
    {
        var session = await _context.Set<VideoSession>()
            .Include(v => v.Appointment)
            .FirstOrDefaultAsync(v => v.SessionId == request.SessionId, cancellationToken)
            ?? throw new NotFoundException("VideoSession", request.SessionId);

        var (userId, role) = await VideoSessionAccessHelper.ResolveCurrentUserAsync(_currentUserService);
        await VideoSessionAccessHelper.EnsureCanAccessSessionAsync(
            _context, userId, role, session, cancellationToken);

        if (session.Status == VideoSessionStatus.Ended)
            return VideoSessionMapper.ToDto(session);

        session.Status = VideoSessionStatus.Ended;
        session.EndedAt = DateTime.UtcNow;
        session.EndReason = request.EndReason;
        session.UpdatedAt = DateTime.UtcNow;

        if (session.Appointment.Status == AppointmentStatus.InProgress)
        {
            session.Appointment.Status = AppointmentStatus.Completed;
            session.Appointment.UpdatedAt = DateTime.UtcNow;
            _context.Update(session.Appointment);
        }

        _context.Update(session);
        await _context.SaveChangesAsync(cancellationToken);

        return VideoSessionMapper.ToDto(session);
    }
}
