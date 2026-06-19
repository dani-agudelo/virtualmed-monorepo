namespace VirtualMed.Infrastructure.Configuration;

public class WebRtcSettings
{
    public string Provider { get; set; } = "Twilio";
    public int TokenTtlMinutes { get; set; } = 60;
    public string[] FallbackStunUrls { get; set; } = ["stun:stun.l.google.com:19302"];
}
