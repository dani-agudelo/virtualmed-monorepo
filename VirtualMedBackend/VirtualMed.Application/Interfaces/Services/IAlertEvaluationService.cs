using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.Interfaces.Services;

public interface IAlertEvaluationService
{
    Task EvaluateReadingsAsync(
        Guid patientId,
        IReadOnlyList<VitalSignReading> readings,
        CancellationToken cancellationToken = default);
}
