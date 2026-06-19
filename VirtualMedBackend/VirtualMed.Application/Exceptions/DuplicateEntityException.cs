namespace VirtualMed.Application.Exceptions;

public class DuplicateEntityException : Exception
{
    public DuplicateEntityException(string message) : base(message)
    {
    }

    public DuplicateEntityException(string entityName, string propertyName, object value)
        : base($"El {entityName} con {propertyName} '{value}' ya existe.")
    {
    }
}
