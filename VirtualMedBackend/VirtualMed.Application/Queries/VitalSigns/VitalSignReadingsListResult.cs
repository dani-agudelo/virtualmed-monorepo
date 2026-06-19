namespace VirtualMed.Application.Queries.VitalSigns;

public class VitalSignReadingsListResult
{
    public required Common.Models.PagedResult<VitalSignReadingDto> Page { get; init; }
    public IReadOnlyDictionary<string, VitalSignLatestDto>? LatestByType { get; init; }
    public IReadOnlyDictionary<string, decimal>? Averages7d { get; init; }
}

public record VitalSignLatestDto(
    Guid Id,
    decimal Value,
    string Unit,
    DateTime ReadingAt,
    string Source);
