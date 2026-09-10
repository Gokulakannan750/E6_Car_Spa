using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppHealthMonitoring : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "HealthStatus",
                table: "WhatsAppConfigurations",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "NotConfigured");

            migrationBuilder.AddColumn<DateTime>(
                name: "LastCheckedAtUtc",
                table: "WhatsAppConfigurations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastErrorMessage",
                table: "WhatsAppConfigurations",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastFailureAtUtc",
                table: "WhatsAppConfigurations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastSuccessAtUtc",
                table: "WhatsAppConfigurations",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HealthStatus",
                table: "WhatsAppConfigurations");

            migrationBuilder.DropColumn(
                name: "LastCheckedAtUtc",
                table: "WhatsAppConfigurations");

            migrationBuilder.DropColumn(
                name: "LastErrorMessage",
                table: "WhatsAppConfigurations");

            migrationBuilder.DropColumn(
                name: "LastFailureAtUtc",
                table: "WhatsAppConfigurations");

            migrationBuilder.DropColumn(
                name: "LastSuccessAtUtc",
                table: "WhatsAppConfigurations");
        }
    }
}
