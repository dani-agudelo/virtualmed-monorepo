using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.VideoSessions;

public class VideoSessionDto
{
    public Guid SessionId { get; set; }
    public Guid AppointmentId { get; set; }
    public Guid PatientId { get; set; }
    public Guid DoctorId { get; set; }
    public VideoSessionStatus Status { get; set; }
    public string RoomToken { get; set; } = string.Empty;
    public DateTime TokenExpiresAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public string? EndReason { get; set; }
}
