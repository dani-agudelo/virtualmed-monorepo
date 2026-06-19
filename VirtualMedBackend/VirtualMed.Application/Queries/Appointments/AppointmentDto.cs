using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Queries.Appointments;

public class AppointmentDto
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public string PatientFullName { get; set; } = string.Empty;
    public Guid DoctorId { get; set; }
    public string DoctorFullName { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public int DurationMinutes { get; set; }
    public AppointmentStatus Status { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool HasClinicalEncounter { get; set; }
    public Guid? VideoSessionId { get; set; }
}
