using MediatR;
using VirtualMed.Application.Roles;

namespace VirtualMed.Application.Queries.Roles;

public record GetPermissionsQuery : IRequest<IReadOnlyList<PermissionListItemDto>>;
