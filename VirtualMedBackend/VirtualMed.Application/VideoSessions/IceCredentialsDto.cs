namespace VirtualMed.Application.VideoSessions;

public class IceCredentialsDto
{
    public Guid SessionId { get; set; }
    public string RoomToken { get; set; } = string.Empty;
    public DateTime TokenExpiresAt { get; set; }
    public IReadOnlyList<IceServerDto> IceServers { get; set; } = [];
}
