using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VirtualMed.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddVideoSessionsAndChat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "video_sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    RoomToken = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    TokenExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EndedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EndReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_video_sessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_video_sessions_appointments_AppointmentId",
                        column: x => x.AppointmentId,
                        principalTable: "appointments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "video_chat_messages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VideoSessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderId = table.Column<Guid>(type: "uuid", nullable: false),
                    Message = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MessageType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_video_chat_messages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_video_chat_messages_video_sessions_VideoSessionId",
                        column: x => x.VideoSessionId,
                        principalTable: "video_sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_video_chat_messages_SentAt",
                table: "video_chat_messages",
                column: "SentAt");

            migrationBuilder.CreateIndex(
                name: "IX_video_chat_messages_VideoSessionId",
                table: "video_chat_messages",
                column: "VideoSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_video_sessions_AppointmentId",
                table: "video_sessions",
                column: "AppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_video_sessions_SessionId",
                table: "video_sessions",
                column: "SessionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_video_sessions_TokenExpiresAt",
                table: "video_sessions",
                column: "TokenExpiresAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "video_chat_messages");

            migrationBuilder.DropTable(
                name: "video_sessions");
        }
    }
}
