using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using VirtualMed.Api.Authorization;
using VirtualMed.Api.Hubs;
using VirtualMed.Api.Models.VideoSessions;
using VirtualMed.Application.Commands.VideoSessions;
using VirtualMed.Application.Queries.VideoSessions;

namespace VirtualMed.Api.Controllers;

[ApiController]
[Route("api/video-sessions")]
[Authorize]
public class VideoSessionsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IHubContext<VideoChatHub> _hubContext;

    public VideoSessionsController(IMediator mediator, IHubContext<VideoChatHub> hubContext)
    {
        _mediator = mediator;
        _hubContext = hubContext;
    }

    [HttpGet("mine")]
    [RequirePermission("VideoSession", "Read")]
    public async Task<IActionResult> ListMine([FromQuery] bool includeEnded = false)
    {
        var result = await _mediator.Send(new ListMyVideoSessionsQuery(includeEnded));
        return Ok(result);
    }

    [HttpPost]
    [RequirePermission("VideoSession", "Create")]
    public async Task<IActionResult> Create([FromBody] CreateVideoSessionBody body)
    {
        var result = await _mediator.Send(new CreateVideoSessionCommand(body.AppointmentId));
        return CreatedAtAction(nameof(GetById), new { sessionId = result.SessionId }, result);
    }

    [HttpGet("{sessionId:guid}")]
    [RequirePermission("VideoSession", "Read")]
    public async Task<IActionResult> GetById(Guid sessionId)
    {
        var result = await _mediator.Send(new GetVideoSessionByIdQuery(sessionId));
        return Ok(result);
    }

    [HttpPost("{sessionId:guid}/start")]
    [RequirePermission("VideoSession", "Start")]
    public async Task<IActionResult> Start(Guid sessionId)
    {
        var result = await _mediator.Send(new StartVideoSessionCommand(sessionId));
        return Ok(result);
    }

    [HttpPost("{sessionId:guid}/end")]
    [RequirePermission("VideoSession", "End")]
    public async Task<IActionResult> End(Guid sessionId, [FromBody] EndVideoSessionBody body)
    {
        var result = await _mediator.Send(new EndVideoSessionCommand(sessionId, body.EndReason));
        await _hubContext.Clients.Group(VideoChatHub.GetRoomName(sessionId)).SendAsync("callEnded", new
        {
            sessionId,
            endReason = body.EndReason
        });
        return Ok(result);
    }

    [HttpPost("{sessionId:guid}/refresh-token")]
    [RequirePermission("VideoSession", "Refresh")]
    public async Task<IActionResult> RefreshToken(Guid sessionId)
    {
        var result = await _mediator.Send(new RefreshVideoSessionTokenCommand(sessionId));
        return Ok(result);
    }

    [HttpGet("{sessionId:guid}/chat")]
    [RequirePermission("VideoChat", "Read")]
    public async Task<IActionResult> GetChatHistory(
        Guid sessionId,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50)
    {
        var result = await _mediator.Send(new GetVideoSessionChatHistoryQuery(sessionId, pageNumber, pageSize));
        return Ok(result);
    }
}
