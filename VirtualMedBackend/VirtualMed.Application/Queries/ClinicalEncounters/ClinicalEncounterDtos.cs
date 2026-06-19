using VirtualMed.Domain.Enums;

namespace VirtualMed.Application.Queries.ClinicalEncounters;

public class ClinicalEncounterListItemDto
{
    public Guid Id { get; set; }
    public Guid AppointmentId { get; set; }
    public Guid PatientId { get; set; }
    public Guid DoctorId { get; set; }
    public EncounterType EncounterType { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime? EndAt { get; set; }
    public string ChiefComplaint { get; set; } = string.Empty;
    public IReadOnlyCollection<DiagnosisDto> Diagnoses { get; set; } = [];
    public IReadOnlyCollection<PrescriptionDto> Prescriptions { get; set; } = [];
}

public class ClinicalEncounterDetailDto
{
    public Guid Id { get; set; }
    public Guid AppointmentId { get; set; }
    public Guid PatientId { get; set; }
    public Guid DoctorId { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime? EndAt { get; set; }
    public string ChiefComplaint { get; set; } = string.Empty;
    public string? CurrentCondition { get; set; }
    public string? PhysicalExam { get; set; }
    public string? Assessment { get; set; }
    public string? Plan { get; set; }
    public string? Notes { get; set; }
    public string? RecordingUrl { get; set; }
    public bool IsLocked { get; set; }
    public EncounterType EncounterType { get; set; }
    public IReadOnlyCollection<DiagnosisDto> Diagnoses { get; set; } = [];
    public IReadOnlyCollection<PrescriptionDto> Prescriptions { get; set; } = [];
}

public class DiagnosisDto
{
    public Guid Id { get; set; }
    public string Icd10Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DiagnosisType Type { get; set; }
}

public class PrescriptionDto
{
    public Guid Id { get; set; }
    public string PrescriptionNumber { get; set; } = string.Empty;
    public DateTime IssuedAt { get; set; }
    public DateOnly? ValidUntil { get; set; }
    public IReadOnlyCollection<PrescriptionMedicationDto> Medications { get; set; } = [];
}

public class PrescriptionMedicationDto
{
    public Guid MedicationId { get; set; }
    public string MedicationName { get; set; } = string.Empty;
    public string Dosage { get; set; } = string.Empty;
    public string Frequency { get; set; } = string.Empty;
    public int DurationDays { get; set; }
    public string? Instructions { get; set; }
}

