using MediatR;

namespace VirtualMed.Application.Queries.Users;

public record GetUsersQuery : IRequest<IReadOnlyList<UserListItemDto>>;
