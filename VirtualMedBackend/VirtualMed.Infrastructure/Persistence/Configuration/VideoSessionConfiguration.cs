using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Infrastructure.Persistence.Configuration;

public class VideoSessionConfiguration : IEntityTypeConfiguration<VideoSession>
{
    public void Configure(EntityTypeBuilder<VideoSession> builder)
    {
        builder.ToTable("video_sessions");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.SessionId).IsRequired();
        builder.HasIndex(x => x.SessionId).IsUnique();

        builder.Property(x => x.Status)
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(x => x.RoomToken)
            .HasMaxLength(512)
            .IsRequired();

        builder.Property(x => x.EndReason).HasMaxLength(1000);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired();

        builder.HasIndex(x => x.AppointmentId);
        builder.HasIndex(x => x.TokenExpiresAt);

        builder.HasOne(x => x.Appointment)
            .WithMany(a => a.VideoSessions)
            .HasForeignKey(x => x.AppointmentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
