using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class WhatsAppNumberUniquePerPlatform : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "UX_WhatsAppConfigurations_PhoneNumberId",
                table: "WhatsAppConfigurations",
                column: "PhoneNumberId",
                unique: true,
                filter: "\"PhoneNumberId\" <> ''");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_WhatsAppConfigurations_PhoneNumberId",
                table: "WhatsAppConfigurations");
        }
    }
}
