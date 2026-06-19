namespace VirtualMed.Application.Exceptions;

public class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message)
    {
    }

    public NotFoundException(string entityName, object key)
        : base($"El {entityName} con identificador '{key}' no fue encontrado.")
    {
    }
}
