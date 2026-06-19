namespace VirtualMed.Api.Configuration;

/// <summary>
/// Carga el .env del monorepo y mapea nombres legibles a variables de ASP.NET Core.
/// </summary>
public static class EnvConfiguration
{
    public static void LoadRootEnvFile()
    {
        var envPath = FindRootEnvFile();
        if (envPath is not null)
        {
            DotNetEnv.Env.Load(envPath);
        }

        ApplyAliases();
    }

    private static string? FindRootEnvFile()
    {
        var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
        for (var depth = 0; depth < 8 && dir is not null; depth++, dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, ".env");
            if (File.Exists(candidate))
                return candidate;
        }

        return null;
    }

    private static void ApplyAliases()
    {
        Map("ConnectionStrings__DefaultConnection", "POSTGRES_CONNECTION");
        Map("Jwt__Key", "JWT_KEY");
        Map("Encryption__Key", "ENCRYPTION_KEY");
        Map("Minio__Endpoint", "MINIO_ENDPOINT");
        Map("Minio__AccessKey", "MINIO_ACCESS_KEY");
        Map("Minio__SecretKey", "MINIO_SECRET_KEY");
        Map("Minio__Bucket", "MINIO_BUCKET");
        Map("Minio__UseSsl", "MINIO_USE_SSL");
        Map("Twilio__AccountSid", "TWILIO_ACCOUNT_SID");
        Map("Twilio__ApiKeySid", "TWILIO_API_KEY_SID");
        Map("Twilio__ApiKeySecret", "TWILIO_API_KEY_SECRET");
        Map("Email__Enabled", "EMAIL_ENABLED");
        Map("Email__FromEmail", "EMAIL_FROM");
        Map("Email__FromName", "EMAIL_FROM_NAME");
        Map("Email__EmailApiKey", "EMAIL_API_KEY");
        Map("Email__FrontendBaseUrl", "EMAIL_FRONTEND_BASE_URL");
        Map("Email__AdminNotificationEmail", "EMAIL_ADMIN_NOTIFICATION");
        Map("RiskPrediction__BaseUrl", "RISK_PREDICTION_BASE_URL");
    }

    private static void Map(string aspNetKey, string envKey)
    {
        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(aspNetKey)))
            return;

        var value = Environment.GetEnvironmentVariable(envKey);
        if (!string.IsNullOrWhiteSpace(value))
            Environment.SetEnvironmentVariable(aspNetKey, value);
    }
}
