using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVehicleRegistrationUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Vehicles_RegistrationNumber",
                table: "Vehicles");

            migrationBuilder.AlterColumn<string>(
                name: "InvoiceTemplateLanguage",
                table: "WhatsAppConfigurations",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "en",
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldDefaultValue: "en_US");

            migrationBuilder.CreateIndex(
                name: "UX_Vehicles_RegistrationNumber",
                table: "Vehicles",
                column: "RegistrationNumber",
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_Vehicles_RegistrationNumber",
                table: "Vehicles");

            migrationBuilder.AlterColumn<string>(
                name: "InvoiceTemplateLanguage",
                table: "WhatsAppConfigurations",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "en_US",
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldDefaultValue: "en");

            migrationBuilder.CreateIndex(
                name: "IX_Vehicles_RegistrationNumber",
                table: "Vehicles",
                column: "RegistrationNumber");
        }
    }
}
