using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Infrastructure.Persistence.Configuration;

public class AlertThresholdConfiguration : IEntityTypeConfiguration<AlertThreshold>
{
    public void Configure(EntityTypeBuilder<AlertThreshold> builder)
    {
        builder.ToTable("alert_thresholds");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.VitalSignType)
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.MinValue).HasPrecision(18, 4).IsRequired();
        builder.Property(x => x.MaxValue).HasPrecision(18, 4).IsRequired();
        builder.Property(x => x.AlertLevel)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.UpdatedAt).IsRequired();

        builder.HasIndex(x => new { x.PatientId, x.VitalSignType }).IsUnique();

        builder.HasOne(x => x.Patient)
            .WithMany()
            .HasForeignKey(x => x.PatientId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
