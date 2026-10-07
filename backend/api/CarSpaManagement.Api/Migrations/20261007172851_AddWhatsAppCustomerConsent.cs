using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppCustomerConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "RequireCustomerConsent",
                table: "WhatsAppConfigurations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "WhatsAppConsent",
                table: "Customers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "WhatsAppConsentUpdatedAtUtc",
                table: "Customers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "WhatsAppConsentUpdatedByUserId",
                table: "Customers",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RequireCustomerConsent",
                table: "WhatsAppConfigurations");

            migrationBuilder.DropColumn(
                name: "WhatsAppConsent",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "WhatsAppConsentUpdatedAtUtc",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "WhatsAppConsentUpdatedByUserId",
                table: "Customers");
        }
    }
}
