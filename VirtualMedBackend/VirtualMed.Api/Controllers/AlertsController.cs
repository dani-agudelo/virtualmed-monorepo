using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VirtualMed.Api.Authorization;
using VirtualMed.Application.Commands.VitalSigns;

namespace VirtualMed.Api.Controllers;

[ApiController]
[Route("api/alerts")]
[Authorize]
public class AlertsController : ControllerBase
{
    private readonly IMediator _mediator;

    public AlertsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPatch("{id:guid}/read")]
    [RequirePermission("Alert", "Update")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        await _mediator.Send(new MarkHealthAlertReadCommand(id));
        return NoContent();
    }
}
