using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Infrastructure.Persistence.Configuration;

public class PatientConfiguration : IEntityTypeConfiguration<Patient>
{
    public void Configure(EntityTypeBuilder<Patient> builder)
    {
        builder.ToTable("patients");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.UserId)
            .IsRequired();

        builder.HasIndex(p => p.UserId);

        builder.Property(p => p.IdentificationType)
            .HasConversion<string>();
        builder.HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId);

        builder.Property(p => p.DateOfBirth)
            .IsRequired();

        builder.Property(p => p.Document)
            .HasMaxLength(20)
            .IsRequired();

        builder.HasIndex(p => p.Document)
            .IsUnique();

        builder.Property(p => p.DateOfBirth)
            .IsRequired();

        builder.Property(p => p.Gender)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(p => p.BloodType)
            .HasMaxLength(10);

        builder.Property(p => p.Allergies)
            .HasMaxLength(2000);

        builder.Property(p => p.PhoneNumber)
            .HasMaxLength(20);

        builder.Property(p => p.AcceptPrivacy)
            .IsRequired();

        builder.Property(p => p.AuthorizeData)
            .IsRequired();
    }
}