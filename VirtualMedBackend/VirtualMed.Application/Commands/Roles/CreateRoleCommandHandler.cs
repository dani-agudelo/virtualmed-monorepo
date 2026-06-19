using MediatR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Exceptions;
using VirtualMed.Application.Interfaces;
using InvalidOperationAppException = VirtualMed.Application.Exceptions.InvalidOperationException;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Commands.Roles;

public class CreateRoleCommandHandler : IRequestHandler<CreateRoleCommand, Guid>
{
    private readonly IApplicationDbContext _context;

    public CreateRoleCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Guid> Handle(CreateRoleCommand request, CancellationToken cancellationToken)
    {
        var nameExists = await _context.Set<Role>()
            .AnyAsync(r => r.Name == request.Name, cancellationToken);
        if (nameExists)
            throw new DuplicateEntityException("Rol", "Nombre", request.Name);

        var permissions = await _context.Set<Permission>()
            .Where(p => request.PermissionIds.Contains(p.Id))
            .ToListAsync(cancellationToken);

        if (permissions.Count != request.PermissionIds.Count)
            throw new InvalidOperationAppException("Uno o más permisos no existen.");

        var role = new Role
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim()
        };

        foreach (var p in permissions)
            role.Permissions.Add(p);

        _context.Add(role);
        await _context.SaveChangesAsync(cancellationToken);

        return role.Id;
    }
}
