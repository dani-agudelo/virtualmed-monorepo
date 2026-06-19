using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VirtualMed.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddVitalSignsAndAlerts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "alert_thresholds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    VitalSignType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    MinValue = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    MaxValue = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    AlertLevel = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_alert_thresholds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_alert_thresholds_patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "vital_sign_readings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    VitalSignType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Value = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    Unit = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ReadingAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DeviceId = table.Column<Guid>(type: "uuid", nullable: true),
                    RawPayload = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vital_sign_readings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_vital_sign_readings_patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "health_alerts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    VitalSignReadingId = table.Column<Guid>(type: "uuid", nullable: true),
                    AlertType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_health_alerts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_health_alerts_patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_health_alerts_vital_sign_readings_VitalSignReadingId",
                        column: x => x.VitalSignReadingId,
                        principalTable: "vital_sign_readings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_alert_thresholds_PatientId_VitalSignType",
                table: "alert_thresholds",
                columns: new[] { "PatientId", "VitalSignType" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_health_alerts_PatientId_IsRead",
                table: "health_alerts",
                columns: new[] { "PatientId", "IsRead" });

            migrationBuilder.CreateIndex(
                name: "IX_health_alerts_PatientId_OccurredAt",
                table: "health_alerts",
                columns: new[] { "PatientId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_health_alerts_VitalSignReadingId",
                table: "health_alerts",
                column: "VitalSignReadingId");

            migrationBuilder.CreateIndex(
                name: "IX_vital_sign_readings_PatientId_ReadingAt",
                table: "vital_sign_readings",
                columns: new[] { "PatientId", "ReadingAt" });

            migrationBuilder.CreateIndex(
                name: "IX_vital_sign_readings_PatientId_VitalSignType_ReadingAt",
                table: "vital_sign_readings",
                columns: new[] { "PatientId", "VitalSignType", "ReadingAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "alert_thresholds");

            migrationBuilder.DropTable(
                name: "health_alerts");

            migrationBuilder.DropTable(
                name: "vital_sign_readings");
        }
    }
}
