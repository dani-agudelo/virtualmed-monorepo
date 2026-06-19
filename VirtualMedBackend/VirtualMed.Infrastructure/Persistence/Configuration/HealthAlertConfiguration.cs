using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Infrastructure.Persistence.Configuration;

public class HealthAlertConfiguration : IEntityTypeConfiguration<HealthAlert>
{
    public void Configure(EntityTypeBuilder<HealthAlert> builder)
    {
        builder.ToTable("health_alerts");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.AlertType).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Message).HasMaxLength(1000).IsRequired();
        builder.Property(x => x.Severity)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.OccurredAt).IsRequired();

        builder.HasIndex(x => new { x.PatientId, x.OccurredAt });
        builder.HasIndex(x => new { x.PatientId, x.IsRead });

        builder.HasOne(x => x.Patient)
            .WithMany()
            .HasForeignKey(x => x.PatientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.VitalSignReading)
            .WithMany()
            .HasForeignKey(x => x.VitalSignReadingId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
