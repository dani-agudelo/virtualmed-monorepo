namespace VirtualMed.Domain.Entities;

public class Medication
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<PrescriptionMedication> Prescriptions { get; set; } = new List<PrescriptionMedication>();
}

