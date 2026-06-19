using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.VideoSessions;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;
using AppInvalidOperationException = VirtualMed.Application.Exceptions.InvalidOperationException;

namespace VirtualMed.Application.Commands.VideoSessions;

public class CreateVideoSessionCommandHandler : IRequestHandler<CreateVideoSessionCommand, VideoSessionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public CreateVideoSessionCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<VideoSessionDto> Handle(CreateVideoSessionCommand request, CancellationToken cancellationToken)
    {
        var appointment = await _context.Set<Appointment>()
            .Include(a => a.VideoSessions)
            .FirstOrDefaultAsync(a => a.Id == request.AppointmentId, cancellationToken)
            ?? throw new NotFoundException("Appointment", request.AppointmentId);

        var (userId, role) = await VideoSessionAccessHelper.ResolveCurrentUserAsync(_currentUserService);
        await VideoSessionAccessHelper.EnsureCanCreateForAppointmentAsync(
            _context, userId, role, appointment, cancellationToken);

        if (appointment.Status != AppointmentStatus.Confirmed)
            throw new AppInvalidOperationException("La cita debe estar Confirmed para crear una sesión de video.");

        var existingActive = appointment.VideoSessions.Any(v =>
            v.Status == VideoSessionStatus.Created || v.Status == VideoSessionStatus.Active);
        if (existingActive)
            throw new AppInvalidOperationException("La cita ya tiene una sesión de video activa o pendiente.");

        var now = DateTime.UtcNow;
        var session = new VideoSession
        {
            Id = Guid.NewGuid(),
            AppointmentId = appointment.Id,
            SessionId = Guid.NewGuid(),
            Status = VideoSessionStatus.Created,
            RoomToken = Guid.NewGuid().ToString("N"),
            TokenExpiresAt = now.AddMinutes(60),
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.Add(session);
        await _context.SaveChangesAsync(cancellationToken);

        session.Appointment = appointment;
        return VideoSessionMapper.ToDto(session);
    }
}
