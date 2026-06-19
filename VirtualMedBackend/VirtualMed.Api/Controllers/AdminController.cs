using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VirtualMed.Api.Authorization;
using VirtualMed.Api.Models.Admin;
using VirtualMed.Application.Commands.Doctors;
using VirtualMed.Application.Commands.Roles;
using VirtualMed.Application.Commands.Users;
using VirtualMed.Application.Queries.Roles;

namespace VirtualMed.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly IMediator _mediator;

    public AdminController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [RequirePermission("Doctor", "Approve")]
    [HttpPost("doctors/{id:guid}/approve")]
    public async Task<IActionResult> ApproveDoctor(Guid id)
    {
        var command = new ApproveDoctorCommand { DoctorId = id };
        await _mediator.Send(command);
        return Ok(new { message = "Doctor aprobado exitosamente." });
    }

    /// <summary>Lista roles con los permisos asignados (claves Resource:Action).</summary>
    [RequirePermission("Role", "Read")]
    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles()
    {
        var list = await _mediator.Send(new GetRolesQuery());
        return Ok(list);
    }

    /// <summary>Lista todos los permisos disponibles para asignar a roles</summary>
    [RequirePermission("Role", "Read")]
    [HttpGet("permissions")]
    public async Task<IActionResult> GetPermissions()
    {
        var list = await _mediator.Send(new GetPermissionsQuery());
        return Ok(list);
    }

    [RequirePermission("Role", "Create")]
    [HttpPost("roles")]
    public async Task<IActionResult> CreateRole([FromBody] CreateRoleRequest request)
    {
        var id = await _mediator.Send(new CreateRoleCommand(request.Name, request.PermissionIds));
        return CreatedAtAction(nameof(GetRoles), null, new { id });
    }

    [RequirePermission("Role", "Update")]
    [HttpPut("roles/{id:guid}")]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] UpdateRoleRequest request)
    {
        await _mediator.Send(new UpdateRoleCommand(id, request.Name, request.PermissionIds));
        return NoContent();
    }

    /// <summary>Asigna un rol a un usuario. El usuario debe volver a iniciar sesión para reflejar permisos en el JWT.</summary>
    [RequirePermission("User", "ManageRoles")]
    [HttpPost("users/{userId:guid}/roles")]
    public async Task<IActionResult> AssignUserRole(Guid userId, [FromBody] AssignUserRoleRequest request)
    {
        await _mediator.Send(new AssignUserRoleCommand(userId, request.RoleId));
        return NoContent();
    }
}
