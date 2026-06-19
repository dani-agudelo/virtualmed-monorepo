namespace VirtualMed.Api.Models;

public class ErrorResponse
{
    public string Timestamp { get; set; } = default!;
    public string Code { get; set; } = default!;
    public string Message { get; set; } = default!;
    public string TraceId { get; set; } = default!;
    public IReadOnlyList<ValidationErrorDetail>? Errors { get; set; }
}

public class ValidationErrorDetail
{
    public string PropertyName { get; set; } = default!;
    public string ErrorMessage { get; set; } = default!;
}
