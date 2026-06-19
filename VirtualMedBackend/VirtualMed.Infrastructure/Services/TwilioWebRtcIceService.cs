using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Application.VideoSessions;
using VirtualMed.Infrastructure.Configuration;

namespace VirtualMed.Infrastructure.Services;

public class TwilioWebRtcIceService : IWebRtcIceService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly TwilioSettings _twilioSettings;
    private readonly WebRtcSettings _webRtcSettings;
    private readonly ILogger<TwilioWebRtcIceService> _logger;

    public TwilioWebRtcIceService(
        IHttpClientFactory httpClientFactory,
        IOptions<TwilioSettings> twilioOptions,
        IOptions<WebRtcSettings> webRtcOptions,
        ILogger<TwilioWebRtcIceService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _twilioSettings = twilioOptions.Value;
        _webRtcSettings = webRtcOptions.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<IceServerDto>> GenerateIceServersAsync(int ttlSeconds, CancellationToken cancellationToken = default)
    {
        if (!string.Equals(_webRtcSettings.Provider, "Twilio", StringComparison.OrdinalIgnoreCase))
            return BuildFallbackIceServers();

        if (string.IsNullOrWhiteSpace(_twilioSettings.AccountSid)
            || string.IsNullOrWhiteSpace(_twilioSettings.ApiKeySid)
            || string.IsNullOrWhiteSpace(_twilioSettings.ApiKeySecret))
        {
            _logger.LogWarning("Twilio credentials are missing; using fallback STUN configuration.");
            return BuildFallbackIceServers();
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            var authValue = Convert.ToBase64String(
                System.Text.Encoding.UTF8.GetBytes($"{_twilioSettings.ApiKeySid}:{_twilioSettings.ApiKeySecret}"));
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", authValue);

            var endpoint = $"https://api.twilio.com/2010-04-01/Accounts/{_twilioSettings.AccountSid}/Tokens.json";
            using var content = new FormUrlEncodedContent(
            [
                new KeyValuePair<string, string>("Ttl", ttlSeconds.ToString())
            ]);

            using var response = await client.PostAsync(endpoint, content, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Twilio ICE token request failed with status {StatusCode}; using fallback STUN.", response.StatusCode);
                return BuildFallbackIceServers();
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var json = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

            if (!json.RootElement.TryGetProperty("ice_servers", out var iceServersElement)
                || iceServersElement.ValueKind != JsonValueKind.Array)
            {
                _logger.LogWarning("Twilio response has no ice_servers array; using fallback STUN.");
                return BuildFallbackIceServers();
            }

            var result = new List<IceServerDto>();
            foreach (var server in iceServersElement.EnumerateArray())
            {
                var urls = new List<string>();
                if (server.TryGetProperty("urls", out var urlsEl))
                {
                    switch (urlsEl.ValueKind)
                    {
                        case JsonValueKind.String:
                            urls.Add(urlsEl.GetString() ?? string.Empty);
                            break;
                        case JsonValueKind.Array:
                            urls.AddRange(urlsEl.EnumerateArray().Select(x => x.GetString() ?? string.Empty));
                            break;
                    }
                }

                if (urls.Count == 0)
                    continue;

                result.Add(new IceServerDto
                {
                    Urls = urls.Where(x => !string.IsNullOrWhiteSpace(x)).ToList(),
                    Username = server.TryGetProperty("username", out var usernameEl) ? usernameEl.GetString() : null,
                    Credential = server.TryGetProperty("credential", out var credentialEl) ? credentialEl.GetString() : null
                });
            }

            return result.Count > 0 ? result : BuildFallbackIceServers();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error generating ICE servers from Twilio; using fallback STUN.");
            return BuildFallbackIceServers();
        }
    }

    private List<IceServerDto> BuildFallbackIceServers()
    {
        return
        [
            new IceServerDto
            {
                Urls = _webRtcSettings.FallbackStunUrls
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .ToList()
            }
        ];
    }
}
