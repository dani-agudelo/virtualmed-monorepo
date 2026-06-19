using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Infrastructure.Persistence.Configuration;

public class VitalSignReadingConfiguration : IEntityTypeConfiguration<VitalSignReading>
{
    public void Configure(EntityTypeBuilder<VitalSignReading> builder)
    {
        builder.ToTable("vital_sign_readings");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.VitalSignType)
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.Value)
            .HasPrecision(18, 4)
            .IsRequired();

        builder.Property(x => x.Unit)
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(x => x.ReadingAt).IsRequired();
        builder.Property(x => x.Source)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.RawPayload).HasMaxLength(4000);
        builder.Property(x => x.CreatedAt).IsRequired();

        builder.HasIndex(x => new { x.PatientId, x.ReadingAt });
        builder.HasIndex(x => new { x.PatientId, x.VitalSignType, x.ReadingAt });

        builder.HasOne(x => x.Patient)
            .WithMany()
            .HasForeignKey(x => x.PatientId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
