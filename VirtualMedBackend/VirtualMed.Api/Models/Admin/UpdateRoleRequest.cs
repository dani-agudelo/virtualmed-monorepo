namespace VirtualMed.Api.Models.Admin;

public class UpdateRoleRequest
{
    public string Name { get; set; } = string.Empty;
    public List<Guid> PermissionIds { get; set; } = new();
}
