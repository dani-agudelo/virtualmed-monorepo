namespace VirtualMed.Application.Common.Exceptions;

public class BusinessRuleException : Exception
{
    public string? ErrorCode { get; }

    public BusinessRuleException(string message) : base(message) { }

    public BusinessRuleException(string errorCode, string message) : base(message)
    {
        ErrorCode = errorCode;
    }

    public BusinessRuleException(string message, Exception inner) : base(message, inner) { }
}
