using Minio;
using Minio.DataModel.Args;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using VirtualMed.Application.Interfaces.Services;
using VirtualMed.Application.Configuration;

namespace VirtualMed.Infrastructure.Services;

public class MinioService : IMinioService
{
    private readonly IMinioClient _minioClient;
    private readonly MinioSettings _settings;
    private readonly ILogger<MinioService> _logger;
    private bool _bucketChecked = false;

    public MinioService(
        IOptions<MinioSettings> settings,
        ILogger<MinioService> logger)
    {
        _settings = settings.Value;
        _logger = logger;

        // Validar configuración
        if (string.IsNullOrWhiteSpace(_settings.Endpoint))
            throw new InvalidOperationException(
                "MinIO 'Endpoint' no configurado. Define MINIO_ENDPOINT en el .env raíz (Docker: minio:9000).");

        if (string.IsNullOrWhiteSpace(_settings.AccessKey))
            throw new InvalidOperationException(
                "MinIO 'AccessKey' no configurado. Define MINIO_ACCESS_KEY en el .env raíz.");

        if (string.IsNullOrWhiteSpace(_settings.SecretKey))
            throw new InvalidOperationException(
                "MinIO 'SecretKey' no configurado. Define MINIO_SECRET_KEY en el .env raíz.");

        var clientBuilder = new MinioClient()
            .WithEndpoint(_settings.Endpoint)
            .WithCredentials(_settings.AccessKey, _settings.SecretKey);

        if (_settings.UseSsl)
            clientBuilder = clientBuilder.WithSSL();

        _minioClient = clientBuilder.Build();

        _logger.LogInformation("MinIO configurado con endpoint: {Endpoint}", _settings.Endpoint);
    }

    public async Task UploadAsync(string bucket, string objectName, Stream data, CancellationToken cancellationToken)
    {
        try
        {
            // Verificar y crear bucket si no existe
            await EnsureBucketExistsAsync(bucket, cancellationToken);

            // Subir archivo
            var putObjectArgs = new PutObjectArgs()
                .WithBucket(bucket)
                .WithObject(objectName)
                .WithStreamData(data)
                .WithObjectSize(data.Length)
                .WithContentType("application/octet-stream");

            await _minioClient.PutObjectAsync(putObjectArgs, cancellationToken);

            _logger.LogInformation(
                "Archivo subido exitosamente: {Bucket}/{ObjectName}",
                bucket,
                objectName);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error al subir archivo a MinIO: {Bucket}/{ObjectName}",
                bucket,
                objectName);
            throw;
        }
    }

    private async Task EnsureBucketExistsAsync(string bucketName, CancellationToken cancellationToken)
    {
        if (_bucketChecked)
            return;

        try
        {
            var bucketExistsArgs = new BucketExistsArgs()
                .WithBucket(bucketName);

            bool exists = await _minioClient.BucketExistsAsync(bucketExistsArgs, cancellationToken);

            if (!exists)
            {
                var makeBucketArgs = new MakeBucketArgs()
                    .WithBucket(bucketName);

                await _minioClient.MakeBucketAsync(makeBucketArgs, cancellationToken);

                _logger.LogInformation("Bucket creado: {BucketName}", bucketName);
            }

            _bucketChecked = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar/crear bucket: {BucketName}", bucketName);
            throw;
        }
    }
}
