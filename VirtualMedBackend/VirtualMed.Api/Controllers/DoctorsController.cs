using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VirtualMed.Api.Authorization;
using VirtualMed.Application.Queries.Doctors;

namespace VirtualMed.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DoctorsController : ControllerBase
{
    private readonly IMediator _mediator;

    public DoctorsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("search")]
    [RequirePermission("Appointment", "Create")]
    public async Task<IActionResult> Search(
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _mediator.Send(new SearchDoctorsQuery(q, page, pageSize));
        return Ok(result);
    }

    [HttpGet("me/availability")]
    [RequirePermission("Appointment", "Create")]
    public async Task<IActionResult> GetMyAvailability(
        [FromQuery] DateTime fromUtc,
        [FromQuery] DateTime toUtc,
        [FromQuery] int slotStepMinutes = 15,
        [FromQuery] int appointmentDurationMinutes = 30)
    {
        var result = await _mediator.Send(new GetMyDoctorAvailabilityQuery(
            fromUtc,
            toUtc,
            slotStepMinutes,
            appointmentDurationMinutes));
        return Ok(result);
    }

    [HttpGet("{doctorId:guid}/availability")]
    [RequirePermission("Appointment", "Create")]
    public async Task<IActionResult> GetAvailability(
        Guid doctorId,
        [FromQuery] DateTime fromUtc,
        [FromQuery] DateTime toUtc,
        [FromQuery] int slotStepMinutes = 15,
        [FromQuery] int appointmentDurationMinutes = 30)
    {
        var result = await _mediator.Send(new GetDoctorAvailabilityQuery(
            doctorId,
            fromUtc,
            toUtc,
            slotStepMinutes,
            appointmentDurationMinutes));
        return Ok(result);
    }
}
