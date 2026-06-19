using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.VideoSessions;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;
using AppInvalidOperationException = VirtualMed.Application.Exceptions.InvalidOperationException;

namespace VirtualMed.Application.Commands.VideoSessions;

public class StartVideoSessionCommandHandler : IRequestHandler<StartVideoSessionCommand, VideoSessionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public StartVideoSessionCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<VideoSessionDto> Handle(StartVideoSessionCommand request, CancellationToken cancellationToken)
    {
        var session = await _context.Set<VideoSession>()
            .Include(v => v.Appointment)
            .FirstOrDefaultAsync(v => v.SessionId == request.SessionId, cancellationToken)
            ?? throw new NotFoundException("VideoSession", request.SessionId);

        var (userId, role) = await VideoSessionAccessHelper.ResolveCurrentUserAsync(_currentUserService);
        await VideoSessionAccessHelper.EnsureCanAccessSessionAsync(
            _context, userId, role, session, cancellationToken);

        if (session.Status == VideoSessionStatus.Ended)
            throw new AppInvalidOperationException("La sesión ya finalizó.");

        if (session.TokenExpiresAt <= DateTime.UtcNow)
        {
            session.Status = VideoSessionStatus.Expired;
            session.UpdatedAt = DateTime.UtcNow;
            _context.Update(session);
            await _context.SaveChangesAsync(cancellationToken);
            throw new AppInvalidOperationException("El token de sala expiró; solicite refresh token.");
        }

        if (session.Appointment.Status != AppointmentStatus.Confirmed
            && session.Appointment.Status != AppointmentStatus.InProgress)
            throw new AppInvalidOperationException("La cita no está en estado permitido para iniciar videollamada.");

        session.Status = VideoSessionStatus.Active;
        session.StartedAt ??= DateTime.UtcNow;
        session.UpdatedAt = DateTime.UtcNow;
        session.Appointment.Status = AppointmentStatus.InProgress;
        session.Appointment.UpdatedAt = DateTime.UtcNow;

        _context.Update(session);
        _context.Update(session.Appointment);
        await _context.SaveChangesAsync(cancellationToken);

        return VideoSessionMapper.ToDto(session);
    }
}
