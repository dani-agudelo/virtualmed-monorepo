using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Infrastructure.Persistence.Configuration;

public class TwoFactorAuthConfiguration : IEntityTypeConfiguration<TwoFactorAuth>
{
    public void Configure(EntityTypeBuilder<TwoFactorAuth> builder)
    {
        builder.ToTable("two_factor_auths");

        builder.HasKey(t => t.UserId);

        builder.Property(t => t.SecretKeyEncrypted)
            .IsRequired()
            .HasMaxLength(512);

        builder.Property(t => t.RecoveryCodesEncrypted)
            .IsRequired()
            .HasMaxLength(4000);

        builder.Property(t => t.IsEnabled)
            .IsRequired();

        builder.Property(t => t.CreatedAt)
            .IsRequired();

        builder.HasOne(t => t.User)
            .WithOne()
            .HasForeignKey<TwoFactorAuth>(t => t.UserId);
    }
}

