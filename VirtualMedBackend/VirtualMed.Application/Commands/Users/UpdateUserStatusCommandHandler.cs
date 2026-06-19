using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.Users;

public class UpdateUserStatusCommandHandler : IRequestHandler<UpdateUserStatusCommand, Unit>
{
    private readonly IApplicationDbContext _context;

    public UpdateUserStatusCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Unit> Handle(UpdateUserStatusCommand request, CancellationToken cancellationToken)
    {
        var user = await _context.Set<User>()
            .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);

        if (user is null)
            throw new NotFoundException("User", request.UserId);

        if (string.Equals(user.Status, request.Status, StringComparison.Ordinal))
            return Unit.Value;

        user.Status = request.Status;
        _context.Update(user);
        await _context.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}
