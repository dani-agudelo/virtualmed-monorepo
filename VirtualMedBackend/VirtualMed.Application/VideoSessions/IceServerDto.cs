namespace VirtualMed.Application.VideoSessions;

public class IceServerDto
{
    public IReadOnlyList<string> Urls { get; set; } = [];
    public string? Username { get; set; }
    public string? Credential { get; set; }
}
