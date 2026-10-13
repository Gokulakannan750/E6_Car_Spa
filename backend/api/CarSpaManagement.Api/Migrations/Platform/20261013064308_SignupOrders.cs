using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations.Platform
{
    /// <inheritdoc />
    public partial class SignupOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SignupOrders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Start = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BusinessName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    OwnerName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Mobile = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Email = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    City = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    State = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Gstin = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: true),
                    PlanCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Interval = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    AndroidLicences = table.Column<int>(type: "integer", nullable: false),
                    WindowsLicences = table.Column<int>(type: "integer", nullable: false),
                    BothLicences = table.Column<int>(type: "integer", nullable: false),
                    AddOnsJson = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    AmountMinor = table.Column<long>(type: "bigint", nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    QuoteJson = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: true),
                    PaymentProvider = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    PaymentReference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    FailureReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignupOrders", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SignupOrders_CompanyId",
                table: "SignupOrders",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_SignupOrders_ProductId_Email",
                table: "SignupOrders",
                columns: new[] { "ProductId", "Email" });

            migrationBuilder.CreateIndex(
                name: "IX_SignupOrders_ProductId_Mobile",
                table: "SignupOrders",
                columns: new[] { "ProductId", "Mobile" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SignupOrders");
        }
    }
}
