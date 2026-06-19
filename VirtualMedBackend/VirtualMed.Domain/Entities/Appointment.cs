using VirtualMed.Domain.Enums;

namespace VirtualMed.Domain.Entities;

public class Appointment
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    public Guid DoctorId { get; set; }
    public Doctor Doctor { get; set; } = null!;

    public DateTime ScheduledAt { get; set; }
    public int DurationMinutes { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Scheduled;
    public string? Reason { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Guid? ClinicalEncounterId { get; set; }
    public ClinicalEncounter? ClinicalEncounter { get; set; }
    public ICollection<VideoSession> VideoSessions { get; set; } = new List<VideoSession>();

    private static readonly Dictionary<AppointmentStatus, List<AppointmentStatus>> StateTransitions = new()
    {
        { AppointmentStatus.Scheduled, new List<AppointmentStatus> { AppointmentStatus.Confirmed, AppointmentStatus.Cancelled } },
        { AppointmentStatus.Confirmed, new List<AppointmentStatus> { AppointmentStatus.InProgress, AppointmentStatus.Cancelled } },
        { AppointmentStatus.InProgress, new List<AppointmentStatus> { AppointmentStatus.Completed, AppointmentStatus.Cancelled } },
        { AppointmentStatus.Completed, new List<AppointmentStatus>() },
        { AppointmentStatus.Cancelled, new List<AppointmentStatus>() },
        { AppointmentStatus.NoShow, new List<AppointmentStatus>() }
    };

    public void UpdateStatus(AppointmentStatus newStatus, TimeSpan cancellationWindow)
    {
        if (!StateTransitions.ContainsKey(Status) || !StateTransitions[Status].Contains(newStatus))
        {
            throw new InvalidOperationException($"Cannot transition from {Status} to {newStatus}.");
        }

        if (newStatus == AppointmentStatus.Cancelled)
        {
            if (ScheduledAt - DateTime.UtcNow < cancellationWindow)
            {
                throw new InvalidOperationException($"Appointment cannot be cancelled within the {cancellationWindow.TotalHours}-hour window before the scheduled time.");
            }
        }

        if (newStatus == AppointmentStatus.InProgress && ClinicalEncounter == null)
        {
            ClinicalEncounter = new ClinicalEncounter
            {
                AppointmentId = Id,
                StartAt = DateTime.UtcNow,
                EncounterType = EncounterType.Telehealth,
                Status = "InProgress",
                ChiefComplaint = "Telehealth Consultation"
            };
        }

        Status = newStatus;
        UpdatedAt = DateTime.UtcNow;
    }
}

