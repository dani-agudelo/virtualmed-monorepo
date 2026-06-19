using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using VirtualMed.Domain.Entities;

namespace VirtualMed.Infrastructure.Persistence.Configuration;

public class VideoChatMessageConfiguration : IEntityTypeConfiguration<VideoChatMessage>
{
    public void Configure(EntityTypeBuilder<VideoChatMessage> builder)
    {
        builder.ToTable("video_chat_messages");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Message)
            .HasMaxLength(4000)
            .IsRequired();

        builder.Property(x => x.SentAt).IsRequired();
        builder.Property(x => x.MessageType)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.HasIndex(x => x.VideoSessionId);
        builder.HasIndex(x => x.SentAt);

        builder.HasOne(x => x.VideoSession)
            .WithMany(v => v.ChatMessages)
            .HasForeignKey(x => x.VideoSessionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
