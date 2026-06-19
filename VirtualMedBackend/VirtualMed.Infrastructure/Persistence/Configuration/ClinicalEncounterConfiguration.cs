using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Infrastructure.Persistence.Configuration;

public class ClinicalEncounterConfiguration : IEntityTypeConfiguration<ClinicalEncounter>
{
    public void Configure(EntityTypeBuilder<ClinicalEncounter> builder)
    {
        builder.ToTable("clinical_encounters");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.EncounterType)
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.ChiefComplaint)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(x => x.CurrentCondition).HasMaxLength(4000);
        builder.Property(x => x.PhysicalExam).HasMaxLength(4000);
        builder.Property(x => x.Assessment).HasMaxLength(4000);
        builder.Property(x => x.Plan).HasMaxLength(4000);
        builder.Property(x => x.Notes).HasMaxLength(4000);
        builder.Property(x => x.RecordingUrl).HasMaxLength(2000);

        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired();

        builder.HasIndex(x => x.AppointmentId).IsUnique();
        builder.HasIndex(x => x.StartAt);

        builder.HasOne(x => x.Appointment)
            .WithOne(x => x.ClinicalEncounter)
            .HasForeignKey<ClinicalEncounter>(x => x.AppointmentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

