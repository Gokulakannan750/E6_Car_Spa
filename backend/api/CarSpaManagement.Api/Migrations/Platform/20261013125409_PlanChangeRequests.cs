using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations.Platform
{
    /// <inheritdoc />
    public partial class PlanChangeRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "BillingInvoices",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Period");

            migrationBuilder.CreateTable(
                name: "PlanChangeRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubscriptionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Timing = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PlanCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Interval = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    AndroidLicences = table.Column<int>(type: "integer", nullable: false),
                    WindowsLicences = table.Column<int>(type: "integer", nullable: false),
                    BothLicences = table.Column<int>(type: "integer", nullable: false),
                    AddOnsJson = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    CurrentPeriodPriceMinor = table.Column<long>(type: "bigint", nullable: false),
                    NewPeriodPriceMinor = table.Column<long>(type: "bigint", nullable: false),
                    AmountNowMinor = table.Column<long>(type: "bigint", nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    EffectiveAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RequestedByAdminId = table.Column<Guid>(type: "uuid", nullable: true),
                    RequestedByEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DecidedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    DecidedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    AppliedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AdjustmentInvoiceId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlanChangeRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlanChangeRequests_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PlanChangeRequests_Subscriptions_SubscriptionId",
                        column: x => x.SubscriptionId,
                        principalTable: "Subscriptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlanChangeRequests_CompanyId_Status",
                table: "PlanChangeRequests",
                columns: new[] { "CompanyId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_PlanChangeRequests_SubscriptionId",
                table: "PlanChangeRequests",
                column: "SubscriptionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlanChangeRequests");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "BillingInvoices");
        }
    }
}
