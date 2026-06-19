using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Infrastructure.Persistence.Configuration;

public class PrescriptionMedicationConfiguration : IEntityTypeConfiguration<PrescriptionMedication>
{
    public void Configure(EntityTypeBuilder<PrescriptionMedication> builder)
    {
        builder.ToTable("prescription_medications");
        builder.HasKey(x => new { x.PrescriptionId, x.MedicationId });

        builder.Property(x => x.Dosage).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Frequency).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Instructions).HasMaxLength(1000);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired();

        builder.HasOne(x => x.Prescription)
            .WithMany(x => x.Medications)
            .HasForeignKey(x => x.PrescriptionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Medication)
            .WithMany(x => x.Prescriptions)
            .HasForeignKey(x => x.MedicationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

