using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Domain.Entities;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Application.Exceptions;

namespace VirtualMed.Application.Commands.Doctors;

public class ApproveDoctorCommandHandler : IRequestHandler<ApproveDoctorCommand, Unit>
{
    private readonly IApplicationDbContext _context;
    private readonly INotificationService _notification;

    public ApproveDoctorCommandHandler(
        IApplicationDbContext context,
        INotificationService notification)
    {
        _context = context;
        _notification = notification;
    }

    public async Task<Unit> Handle(ApproveDoctorCommand request, CancellationToken cancellationToken)
    {
        // Buscar el doctor
        var doctor = await _context.Set<Doctor>()
            .FirstOrDefaultAsync(d => d.Id == request.DoctorId, cancellationToken);

        if (doctor == null)
            throw new NotFoundException("Doctor", request.DoctorId);

        // Verificar si ya está verificado
        if (doctor.Verified)
            throw new VirtualMed.Application.Exceptions.InvalidOperationException(
                $"El doctor con ID {request.DoctorId} ya está verificado.");

        // Buscar el usuario relacionado
        var user = await _context.Set<User>()
            .FirstOrDefaultAsync(u => u.Id == doctor.UserId, cancellationToken);

        if (user == null)
            throw new NotFoundException("Usuario asociado al doctor", doctor.UserId);

        // Actualizar doctor
        doctor.Verified = true;
        _context.Update(doctor);

        // Actualizar usuario
        user.Status = "Active";
        _context.Update(user);

        await _context.SaveChangesAsync(cancellationToken);

        // Notificar al doctor
        await _notification.NotifyAdminAsync(
            $"Doctor con email {user.Email} ha sido aprobado y activado.");

        return Unit.Value;
    }
}
