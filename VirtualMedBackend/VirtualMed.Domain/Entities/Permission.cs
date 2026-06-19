namespace VirtualMed.Domain.Entities;

public class Permission
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string Resource { get; set; } = null!;
    public string Action { get; set; } = null!;

    public ICollection<Role> Roles { get; set; } = new List<Role>();
}
