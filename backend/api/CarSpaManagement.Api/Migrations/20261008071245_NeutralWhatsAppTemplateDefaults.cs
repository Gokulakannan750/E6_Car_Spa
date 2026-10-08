using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class NeutralWhatsAppTemplateDefaults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "PaymentCompletedTemplateName",
                table: "WhatsAppConfigurations",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "payment_completed",
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldDefaultValue: "e6_carspa_payment_completed");

            migrationBuilder.AlterColumn<string>(
                name: "InvoiceTemplateName",
                table: "WhatsAppConfigurations",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "invoice_generated",
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldDefaultValue: "e6_carspa_invoice_generated");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "PaymentCompletedTemplateName",
                table: "WhatsAppConfigurations",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "e6_carspa_payment_completed",
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldDefaultValue: "payment_completed");

            migrationBuilder.AlterColumn<string>(
                name: "InvoiceTemplateName",
                table: "WhatsAppConfigurations",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "e6_carspa_invoice_generated",
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldDefaultValue: "invoice_generated");
        }
    }
}
