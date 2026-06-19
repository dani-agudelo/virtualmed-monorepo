namespace VirtualMed.Application.Queries.Patients;

public class PatientSearchItemDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Document { get; set; } = string.Empty;
}
