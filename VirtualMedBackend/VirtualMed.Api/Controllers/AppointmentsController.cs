using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VirtualMed.Api.Authorization;
using VirtualMed.Api.Models.Appointments;
using VirtualMed.Application.Commands.Appointments;
using VirtualMed.Application.Queries.Appointments;

namespace VirtualMed.Api.Controllers;

[ApiController]
[Route("api/appointments")]
[Authorize]
public class AppointmentsController : ControllerBase
{
    private readonly IMediator _mediator;

    public AppointmentsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost]
    [RequirePermission("Appointment", "Create")]
    public async Task<IActionResult> Create([FromBody] CreateAppointmentCommand command)
    {
        var id = await _mediator.Send(command);
        return CreatedAtAction(nameof(GetById), new { id }, new { id });
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("Appointment", "Read")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _mediator.Send(new GetAppointmentByIdQuery(id));
        if (result is null)
            return NotFound();
        return Ok(result);
    }

    [HttpGet]
    [RequirePermission("Appointment", "Read")]
    public async Task<IActionResult> List(
        [FromQuery] Guid? patientId,
        [FromQuery] Guid? doctorId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to)
    {
        var result = await _mediator.Send(new ListAppointmentsQuery(patientId, doctorId, from, to));
        return Ok(result);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("Appointment", "Update")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAppointmentBody body)
    {
        await _mediator.Send(new UpdateAppointmentCommand(
            id,
            body.Status,
            body.ScheduledAt,
            body.DurationMinutes,
            body.Reason));
        return NoContent();
    }
}
