namespace VirtualMed.Domain.Entities;

public class Role
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;

    public ICollection<Permission> Permissions { get; set; } = new List<Permission>();
}
