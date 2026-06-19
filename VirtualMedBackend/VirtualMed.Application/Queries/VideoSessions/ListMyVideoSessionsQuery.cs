using MediatR;
using VirtualMed.Application.VideoSessions;

namespace VirtualMed.Application.Queries.VideoSessions;

/// <param name="IncludeEnded">Si es false, solo Created, Active y Expired.</param>
/// <remarks>Doctor/Specialist: sesiones de sus citas. Patient: sesiones donde es el paciente de la cita.</remarks>
public record ListMyVideoSessionsQuery(bool IncludeEnded = false)
    : IRequest<IReadOnlyCollection<VideoSessionDto>>;
