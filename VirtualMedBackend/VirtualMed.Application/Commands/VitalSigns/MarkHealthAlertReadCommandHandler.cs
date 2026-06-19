using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.VitalSigns;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.VitalSigns;

public class MarkHealthAlertReadCommandHandler : IRequestHandler<MarkHealthAlertReadCommand, Unit>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public MarkHealthAlertReadCommandHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<Unit> Handle(MarkHealthAlertReadCommand request, CancellationToken cancellationToken)
    {
        var alert = await _context.Set<HealthAlert>()
            .FirstOrDefaultAsync(a => a.Id == request.AlertId, cancellationToken)
            ?? throw new Exceptions.NotFoundException("Alerta", request.AlertId);

        await PatientVitalAccessResolver.ResolvePatientIdForReadAsync(
            _context,
            _currentUser,
            alert.PatientId,
            cancellationToken);

        alert.IsRead = true;
        _context.Update(alert);
        await _context.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
