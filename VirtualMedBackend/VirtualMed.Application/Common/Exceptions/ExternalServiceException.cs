namespace VirtualMed.Application.Common.Exceptions;

public class ExternalServiceException : Exception
{
    public string? ServiceName { get; }

    public ExternalServiceException(string message) : base(message) { }

    public ExternalServiceException(string message, string? serviceName) : base(message)
    {
        ServiceName = serviceName;
    }

    public ExternalServiceException(string message, Exception inner) : base(message, inner) { }
}
