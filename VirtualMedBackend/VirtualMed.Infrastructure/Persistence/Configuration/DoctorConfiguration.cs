using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Infrastructure.Persistence.Configuration;

public class DoctorConfiguration : IEntityTypeConfiguration<Doctor>
{
    public void Configure(EntityTypeBuilder<Doctor> builder)
    {
        builder.ToTable("doctors");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.ProfessionalLicense)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(d => d.Verified)
            .HasDefaultValue(false);

        // relación con User
        builder.HasOne(d => d.User)
            .WithMany()
            .HasForeignKey(d => d.UserId);
    }
}