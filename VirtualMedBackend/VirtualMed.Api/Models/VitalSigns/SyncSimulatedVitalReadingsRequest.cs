using VirtualMed.Application.VitalSigns;

namespace VirtualMed.Api.Models.VitalSigns;

public class SyncSimulatedVitalReadingsRequest
{
    public Guid? PatientId { get; set; }
    public List<VitalSignReadingItemDto> Readings { get; set; } = [];
}
