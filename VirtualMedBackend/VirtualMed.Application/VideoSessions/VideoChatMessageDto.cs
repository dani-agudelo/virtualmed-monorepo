using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.VideoSessions;

public class VideoChatMessageDto
{
    public Guid Id { get; set; }
    public Guid VideoSessionId { get; set; }
    public Guid SenderId { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTime SentAt { get; set; }
    public VideoChatMessageType MessageType { get; set; }
}
