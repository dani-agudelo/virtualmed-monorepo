using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.Users;

public class AssignUserRoleCommandHandler : IRequestHandler<AssignUserRoleCommand, Unit>
{
    private readonly IApplicationDbContext _context;

    public AssignUserRoleCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Unit> Handle(AssignUserRoleCommand request, CancellationToken cancellationToken)
    {
        var user = await _context.Set<User>()
            .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);

        if (user == null)
            throw new NotFoundException("Usuario", request.UserId);

        var roleExists = await _context.Set<Role>()
            .AnyAsync(r => r.Id == request.RoleId, cancellationToken);

        if (!roleExists)
            throw new NotFoundException("Rol", request.RoleId);

        user.RoleId = request.RoleId;
        _context.Update(user);
        await _context.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}
