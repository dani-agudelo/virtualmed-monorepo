using MediatR;

namespace VirtualMed.Application.Queries.VitalSigns;

public record ListAlertThresholdsQuery(Guid? PatientId) : IRequest<IReadOnlyList<AlertThresholdDto>>;
