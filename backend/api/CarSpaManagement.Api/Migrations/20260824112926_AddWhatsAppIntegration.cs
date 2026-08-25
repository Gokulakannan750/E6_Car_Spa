using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WhatsAppConfigurations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SingletonKey = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    PhoneNumberId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    BusinessAccountId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    GraphApiVersion = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "v25.0"),
                    AccessTokenEncrypted = table.Column<string>(type: "text", nullable: true),
                    InvoiceNotificationsEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    PaymentCompletedNotificationsEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    InvoiceTemplateName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false, defaultValue: "e6_carspa_invoice_generated"),
                    InvoiceTemplateLanguage = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "en_US"),
                    PaymentCompletedTemplateName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false, defaultValue: "e6_carspa_payment_completed"),
                    PaymentCompletedTemplateLanguage = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "en_US"),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WhatsAppConfigurations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WhatsAppMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    MessageType = table.Column<int>(type: "integer", nullable: false),
                    RecipientPhone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    MetaMessageId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    SentAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FailedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ErrorMessage = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    AttemptCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    LastAttemptAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NextAttemptAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TemplateParametersJson = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WhatsAppMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WhatsAppMessages_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WhatsAppMessages_Invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "Invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "UX_WhatsAppConfigurations_Singleton",
                table: "WhatsAppConfigurations",
                column: "SingletonKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WhatsAppMessages_CustomerId",
                table: "WhatsAppMessages",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_WhatsAppMessages_NextAttemptAtUtc",
                table: "WhatsAppMessages",
                column: "NextAttemptAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_WhatsAppMessages_Status",
                table: "WhatsAppMessages",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "UX_WhatsAppMessages_Invoice_MessageType",
                table: "WhatsAppMessages",
                columns: new[] { "InvoiceId", "MessageType" },
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WhatsAppConfigurations");

            migrationBuilder.DropTable(
                name: "WhatsAppMessages");
        }
    }
}
