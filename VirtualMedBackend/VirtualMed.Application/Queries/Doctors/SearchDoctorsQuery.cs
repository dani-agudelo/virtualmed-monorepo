using MediatR;
using VirtualMed.Application.Common.Models;

namespace VirtualMed.Application.Queries.Doctors;

public record SearchDoctorsQuery(string? Q, int Page = 1, int PageSize = 20)
    : IRequest<PagedResult<DoctorSearchItemDto>>;
