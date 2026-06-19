using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Infrastructure.Persistence.Configuration;

public class PrescriptionConfiguration : IEntityTypeConfiguration<Prescription>
{
    public void Configure(EntityTypeBuilder<Prescription> builder)
    {
        builder.ToTable("prescriptions");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.PrescriptionNumber)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(x => x.DoctorSignatureHash).HasMaxLength(512);

        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired();

        builder.HasIndex(x => x.EncounterId);
        builder.HasIndex(x => x.PatientId);
        builder.HasIndex(x => x.DoctorId);
        builder.HasIndex(x => x.IssuedAt);
        builder.HasIndex(x => x.PrescriptionNumber).IsUnique();

        builder.HasOne(x => x.Encounter)
            .WithMany(x => x.Prescriptions)
            .HasForeignKey(x => x.EncounterId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Patient)
            .WithMany()
            .HasForeignKey(x => x.PatientId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Doctor)
            .WithMany()
            .HasForeignKey(x => x.DoctorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

