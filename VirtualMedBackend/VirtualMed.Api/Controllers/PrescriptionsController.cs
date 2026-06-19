using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VirtualMed.Api.Authorization;
using VirtualMed.Application.Commands.Prescriptions;
using VirtualMed.Application.Queries.Prescriptions;

namespace VirtualMed.Api.Controllers;

[ApiController]
[Route("api/prescriptions")]
[Authorize]
public class PrescriptionsController : ControllerBase
{
    private readonly IMediator _mediator;

    public PrescriptionsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost]
    [RequirePermission("Prescription", "Create")]
    public async Task<IActionResult> Create([FromBody] CreatePrescriptionCommand command)
    {
        var id = await _mediator.Send(command);
        return CreatedAtAction(nameof(GetById), new { id }, new { id });
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("Prescription", "Read")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _mediator.Send(new GetPrescriptionByIdQuery(id));
        if (result is null)
            return NotFound();
        return Ok(result);
    }

    [HttpGet("by-encounter/{encounterId:guid}")]
    [RequirePermission("Prescription", "Read")]
    public async Task<IActionResult> ListByEncounter(Guid encounterId)
    {
        var result = await _mediator.Send(new ListPrescriptionsByEncounterQuery(encounterId));
        return Ok(result);
    }
}
