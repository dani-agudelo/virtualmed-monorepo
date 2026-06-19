using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using VirtualMed.Application.Interfaces;
using VirtualMed.Application.VideoSessions;
using VirtualMed.Domain.Entities;
using VirtualMed.Domain.Enums;

namespace VirtualMed.Api.Hubs;

[Authorize]
public class VideoChatHub : Hub
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public VideoChatHub(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    [Authorize(Policy = "Permission:VideoChat:Join")]
    public async Task JoinRoom(Guid sessionId)
    {
        var session = await LoadSessionAsync(sessionId, Context.ConnectionAborted);
        var (userId, role) = await VideoSessionAccessHelper.ResolveCurrentUserAsync(_currentUserService);
        await VideoSessionAccessHelper.EnsureCanAccessSessionAsync(_context, userId, role, session, Context.ConnectionAborted);

        await Groups.AddToGroupAsync(Context.ConnectionId, GetRoom(sessionId), Context.ConnectionAborted);
        Context.Items["videoSessionId"] = sessionId;
        await Clients.Caller.SendAsync("joinedRoom", new { sessionId }, cancellationToken: Context.ConnectionAborted);
        await Clients.OthersInGroup(GetRoom(sessionId)).SendAsync("participantJoined", new
        {
            sessionId,
            userId,
            connectionId = Context.ConnectionId
        }, cancellationToken: Context.ConnectionAborted);
    }

    [Authorize(Policy = "Permission:VideoChat:Join")]
    public async Task LeaveRoom(Guid sessionId)
    {
        var session = await LoadSessionAsync(sessionId, Context.ConnectionAborted);
        var (userId, role) = await VideoSessionAccessHelper.ResolveCurrentUserAsync(_currentUserService);
        await VideoSessionAccessHelper.EnsureCanAccessSessionAsync(_context, userId, role, session, Context.ConnectionAborted);

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GetRoom(sessionId), Context.ConnectionAborted);
        Context.Items.Remove("videoSessionId");
        await Clients.Group(GetRoom(sessionId)).SendAsync("participantLeft", new
        {
            sessionId,
            userId,
            connectionId = Context.ConnectionId
        }, cancellationToken: Context.ConnectionAborted);
    }

    [Authorize(Policy = "Permission:VideoChat:Join")]
    public async Task SendOffer(Guid sessionId, object sdp)
    {
        await EnsureMembershipAsync(sessionId);
        await Clients.OthersInGroup(GetRoom(sessionId))
            .SendAsync("offer", new { sessionId, fromConnectionId = Context.ConnectionId, sdp }, Context.ConnectionAborted);
    }

    [Authorize(Policy = "Permission:VideoChat:Join")]
    public async Task SendAnswer(Guid sessionId, object sdp)
    {
        await EnsureMembershipAsync(sessionId);
        await Clients.OthersInGroup(GetRoom(sessionId))
            .SendAsync("answer", new { sessionId, fromConnectionId = Context.ConnectionId, sdp }, Context.ConnectionAborted);
    }

    [Authorize(Policy = "Permission:VideoChat:Join")]
    public async Task SendIceCandidate(Guid sessionId, object candidate)
    {
        await EnsureMembershipAsync(sessionId);
        await Clients.OthersInGroup(GetRoom(sessionId))
            .SendAsync("iceCandidate", new { sessionId, fromConnectionId = Context.ConnectionId, candidate }, Context.ConnectionAborted);
    }

    [Authorize(Policy = "Permission:VideoChat:Send")]
    public async Task SendMessage(Guid sessionId, string message, VideoChatMessageType messageType = VideoChatMessageType.Text)
    {
        if (string.IsNullOrWhiteSpace(message))
            return;

        var session = await LoadSessionAsync(sessionId, Context.ConnectionAborted);
        var (userId, role) = await VideoSessionAccessHelper.ResolveCurrentUserAsync(_currentUserService);
        await VideoSessionAccessHelper.EnsureCanAccessSessionAsync(_context, userId, role, session, Context.ConnectionAborted);

        var entity = new VideoChatMessage
        {
            Id = Guid.NewGuid(),
            VideoSessionId = session.Id,
            SenderId = userId,
            Message = message.Trim(),
            SentAt = DateTime.UtcNow,
            MessageType = messageType
        };
        _context.Add(entity);
        await _context.SaveChangesAsync(Context.ConnectionAborted);

        await Clients.Group(GetRoom(sessionId)).SendAsync("messageReceived", new
        {
            id = entity.Id,
            sessionId,
            senderId = entity.SenderId,
            message = entity.Message,
            sentAt = entity.SentAt,
            messageType = entity.MessageType.ToString()
        }, cancellationToken: Context.ConnectionAborted);
    }

    private async Task<VideoSession> LoadSessionAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await _context.Set<VideoSession>()
            .Include(v => v.Appointment)
            .FirstOrDefaultAsync(v => v.SessionId == sessionId, cancellationToken);
        if (session is null)
            throw new HubException("Video session not found.");
        return session;
    }

    private async Task EnsureMembershipAsync(Guid sessionId)
    {
        var session = await LoadSessionAsync(sessionId, Context.ConnectionAborted);
        var (userId, role) = await VideoSessionAccessHelper.ResolveCurrentUserAsync(_currentUserService);
        await VideoSessionAccessHelper.EnsureCanAccessSessionAsync(_context, userId, role, session, Context.ConnectionAborted);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Context.Items.TryGetValue("videoSessionId", out var sessionValue)
            && sessionValue is Guid sessionId)
        {
            var (userId, _) = await VideoSessionAccessHelper.ResolveCurrentUserAsync(_currentUserService);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, GetRoom(sessionId), CancellationToken.None);
            await Clients.Group(GetRoom(sessionId)).SendAsync("participantLeft", new
            {
                sessionId,
                userId,
                connectionId = Context.ConnectionId
            }, cancellationToken: CancellationToken.None);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public static string GetRoomName(Guid sessionId) => $"video-session-{sessionId:N}";

    private static string GetRoom(Guid sessionId) => GetRoomName(sessionId);
}
