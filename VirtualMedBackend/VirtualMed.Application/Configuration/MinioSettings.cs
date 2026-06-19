namespace VirtualMed.Application.Configuration;

public class MinioSettings
{
    public required string Endpoint { get; set; }
    public required string AccessKey { get; set; }
    public required string SecretKey { get; set; }
    public required string Bucket { get; set; }
    public bool UseSsl { get; set; }
}
