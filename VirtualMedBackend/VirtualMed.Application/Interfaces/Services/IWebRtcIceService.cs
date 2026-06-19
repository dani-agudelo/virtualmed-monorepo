using VirtualMed.Application.VideoSessions;

namespace VirtualMed.Application.Interfaces.Services;

public interface IWebRtcIceService
{
    Task<IReadOnlyList<IceServerDto>> GenerateIceServersAsync(int ttlSeconds, CancellationToken cancellationToken = default);
}
