using MediatR;
using VirtualMed.Application.Common.Models;

namespace VirtualMed.Application.Queries.Patients;

public record SearchPatientsQuery(string? Q, int Page = 1, int PageSize = 20)
    : IRequest<PagedResult<PatientSearchItemDto>>;
