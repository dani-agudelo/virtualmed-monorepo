using VirtualMed.Domain.Enums;

namespace VirtualMed.Domain.Entities;

public class VideoSession
{
    public Guid Id { get; set; }
    public Guid AppointmentId { get; set; }
    public Appointment Appointment { get; set; } = null!;

    public Guid SessionId { get; set; }
    public VideoSessionStatus Status { get; set; } = VideoSessionStatus.Created;
    public string RoomToken { get; set; } = null!;
    public DateTime TokenExpiresAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public string? EndReason { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<VideoChatMessage> ChatMessages { get; set; } = new List<VideoChatMessage>();
}
