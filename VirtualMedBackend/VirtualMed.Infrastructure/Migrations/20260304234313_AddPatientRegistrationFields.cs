using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VirtualMed.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPatientRegistrationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<DateOnly>(
                name: "DateOfBirth",
                table: "patients",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AddColumn<bool>(
                name: "AcceptPrivacy",
                table: "patients",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AuthorizeData",
                table: "patients",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "IdentificationType",
                table: "patients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhoneNumber",
                table: "patients",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_patients_Document",
                table: "patients",
                column: "Document",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_patients_Document",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "AcceptPrivacy",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "AuthorizeData",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "IdentificationType",
                table: "patients");

            migrationBuilder.DropColumn(
                name: "PhoneNumber",
                table: "patients");

            migrationBuilder.AlterColumn<DateTime>(
                name: "DateOfBirth",
                table: "patients",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateOnly),
                oldType: "date");
        }
    }
}
