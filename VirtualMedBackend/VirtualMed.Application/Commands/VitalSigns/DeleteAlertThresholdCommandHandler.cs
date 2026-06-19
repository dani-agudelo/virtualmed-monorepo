using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.VitalSigns;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.VitalSigns;

public class DeleteAlertThresholdCommandHandler : IRequestHandler<DeleteAlertThresholdCommand, Unit>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public DeleteAlertThresholdCommandHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<Unit> Handle(DeleteAlertThresholdCommand request, CancellationToken cancellationToken)
    {
        var patientId = await PatientAlertThresholdAccessResolver.ResolvePatientIdForThresholdWriteAsync(
            _context,
            _currentUser,
            request.PatientId,
            cancellationToken);

        var entity = await _context.Set<AlertThreshold>()
            .FirstOrDefaultAsync(t => t.Id == request.Id && t.PatientId == patientId, cancellationToken)
            ?? throw new Exceptions.NotFoundException("Umbral", request.Id);

        _context.Remove(entity);
        await _context.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
