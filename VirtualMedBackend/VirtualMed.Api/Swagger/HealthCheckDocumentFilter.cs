using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace VirtualMed.Api.Swagger;

public class HealthCheckDocumentFilter : IDocumentFilter
{
    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        swaggerDoc.Paths.Add("/health", new OpenApiPathItem
        {
            Operations = new Dictionary<OperationType, OpenApiOperation>
            {
                [OperationType.Get] = new OpenApiOperation
                {
                    Summary = "Health check",
                    Description = "Returns the overall health status of the API and its dependencies.",
                    Tags = new List<OpenApiTag> { new() { Name = "Health" } },
                    Responses = new OpenApiResponses
                    {
                        ["200"] = new OpenApiResponse { Description = "Healthy" },
                        ["503"] = new OpenApiResponse { Description = "Unhealthy" }
                    }
                }
            }
        });

        swaggerDoc.Paths.Add("/health/db", new OpenApiPathItem
        {
            Operations = new Dictionary<OperationType, OpenApiOperation>
            {
                [OperationType.Get] = new OpenApiOperation
                {
                    Summary = "Database health check",
                    Description = "Returns the health status of the database connection.",
                    Tags = new List<OpenApiTag> { new() { Name = "Health" } },
                    Responses = new OpenApiResponses
                    {
                        ["200"] = new OpenApiResponse { Description = "Database is reachable" },
                        ["503"] = new OpenApiResponse { Description = "Database is unreachable" }
                    }
                }
            }
        });
    }
}
