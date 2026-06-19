namespace VirtualMed.Application.Queries.Doctors;

public class DoctorSearchItemDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string ProfessionalLicense { get; set; } = string.Empty;
}
