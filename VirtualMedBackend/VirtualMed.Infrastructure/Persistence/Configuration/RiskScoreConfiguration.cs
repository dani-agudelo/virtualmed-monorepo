using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Infrastructure.Persistence.Configuration;

public class RiskScoreConfiguration : IEntityTypeConfiguration<RiskScore>
{
    public void Configure(EntityTypeBuilder<RiskScore> builder)
    {
        builder.ToTable("risk_scores");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Score).IsRequired();
        builder.Property(x => x.RiskLevel).HasMaxLength(20).IsRequired();
        builder.Property(x => x.ModelVersion).HasMaxLength(32).IsRequired();
        builder.Property(x => x.DisclaimerVersion).HasMaxLength(64).IsRequired();
        builder.Property(x => x.CalculatedAt).IsRequired();
        builder.Property(x => x.InputSnapshot).HasMaxLength(8000).IsRequired();

        builder.HasIndex(x => new { x.PatientId, x.CalculatedAt });

        builder.HasOne(x => x.Patient)
            .WithMany()
            .HasForeignKey(x => x.PatientId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
