using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VirtualMed.Api.Authorization;
using VirtualMed.Api.Models.VitalSigns;
using VirtualMed.Application.Commands.VitalSigns;

namespace VirtualMed.Api.Controllers;

[ApiController]
[Route("api/wearables")]
[Authorize]
public class WearablesController : ControllerBase
{
    private readonly IMediator _mediator;

    public WearablesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("simulated/sync")]
    [RequirePermission("VitalSign", "BulkCreate")]
    public async Task<IActionResult> SyncSimulated([FromBody] SyncSimulatedVitalReadingsRequest body)
    {
        var result = await _mediator.Send(new SyncSimulatedVitalReadingsCommand(body.PatientId, body.Readings));
        return Ok(result);
    }
}
