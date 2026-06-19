using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Infrastructure.Persistence.Configuration;

public class DiagnosisConfiguration : IEntityTypeConfiguration<Diagnosis>
{
    public void Configure(EntityTypeBuilder<Diagnosis> builder)
    {
        builder.ToTable("diagnoses");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Icd10Code)
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(x => x.Description)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(x => x.Type)
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired();

        builder.HasIndex(x => x.EncounterId);
        builder.HasIndex(x => x.Icd10Code);

        builder.HasOne(x => x.Encounter)
            .WithMany(x => x.Diagnoses)
            .HasForeignKey(x => x.EncounterId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

