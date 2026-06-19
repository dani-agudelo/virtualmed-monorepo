using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VirtualMed.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAppointmentStateMachineAndEncounterStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "clinical_encounters",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "ClinicalEncounterId",
                table: "appointments",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Status",
                table: "clinical_encounters");

            migrationBuilder.DropColumn(
                name: "ClinicalEncounterId",
                table: "appointments");
        }
    }
}
