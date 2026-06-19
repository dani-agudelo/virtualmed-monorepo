using VirtualMed.Domain.Entities;

namespace VirtualMed.Application.VideoSessions;

internal static class VideoSessionMapper
{
    public static VideoSessionDto ToDto(VideoSession session)
    {
        return new VideoSessionDto
        {
            SessionId = session.SessionId,
            AppointmentId = session.AppointmentId,
            PatientId = session.Appointment.PatientId,
            DoctorId = session.Appointment.DoctorId,
            Status = session.Status,
            RoomToken = session.RoomToken,
            TokenExpiresAt = session.TokenExpiresAt,
            StartedAt = session.StartedAt,
            EndedAt = session.EndedAt,
            EndReason = session.EndReason
        };
    }
}
