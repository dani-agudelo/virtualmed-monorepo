using VirtualMed.Domain.Enums;

namespace VirtualMed.Api.Models.Appointments;

public class UpdateAppointmentBody
{
    public AppointmentStatus? Status { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public int? DurationMinutes { get; set; }
    public string? Reason { get; set; }
}
