using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using InvalidOperationAppException = VirtualMed.Application.Exceptions.InvalidOperationException;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.Roles;

public class UpdateRoleCommandHandler : IRequestHandler<UpdateRoleCommand, Unit>
{
    private readonly IApplicationDbContext _context;

    public UpdateRoleCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Unit> Handle(UpdateRoleCommand request, CancellationToken cancellationToken)
    {
        var role = await _context.Set<Role>()
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Id == request.RoleId, cancellationToken);

        if (role == null)
            throw new NotFoundException("Rol", request.RoleId);

        var nameTaken = await _context.Set<Role>()
            .AnyAsync(r => r.Name == request.Name && r.Id != request.RoleId, cancellationToken);
        if (nameTaken)
            throw new DuplicateEntityException("Rol", "Nombre", request.Name);

        var permissions = await _context.Set<Permission>()
            .Where(p => request.PermissionIds.Contains(p.Id))
            .ToListAsync(cancellationToken);

        if (permissions.Count != request.PermissionIds.Count)
            throw new InvalidOperationAppException("Uno o más permisos no existen.");

        role.Name = request.Name.Trim();
        role.Permissions.Clear();
        foreach (var p in permissions)
            role.Permissions.Add(p);

        _context.Update(role);
        await _context.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}
