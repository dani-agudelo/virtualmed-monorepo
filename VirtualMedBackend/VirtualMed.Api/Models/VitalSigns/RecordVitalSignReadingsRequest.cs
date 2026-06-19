using VirtualMed.Application.VitalSigns;

namespace VirtualMed.Api.Models.VitalSigns;

public class RecordVitalSignReadingsRequest
{
    public List<VitalSignReadingItemDto> Readings { get; set; } = [];
}
