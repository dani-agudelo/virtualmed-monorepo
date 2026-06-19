using VirtualMed.Domain.Enums;

namespace VirtualMed.Domain.Entities;

public class VideoChatMessage
{
    public Guid Id { get; set; }
    public Guid VideoSessionId { get; set; }
    public VideoSession VideoSession { get; set; } = null!;

    public Guid SenderId { get; set; }
    public string Message { get; set; } = null!;
    public DateTime SentAt { get; set; }
    public VideoChatMessageType MessageType { get; set; } = VideoChatMessageType.Text;
}
