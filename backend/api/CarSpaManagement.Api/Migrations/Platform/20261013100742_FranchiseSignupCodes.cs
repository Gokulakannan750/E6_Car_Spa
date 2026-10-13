using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations.Platform
{
    /// <inheritdoc />
    public partial class FranchiseSignupCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "FranchiseConsent",
                table: "SignupOrders",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "FranchiseLinkId",
                table: "SignupOrders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FranchiseProblem",
                table: "SignupOrders",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FranchiseSignupCodeId",
                table: "SignupOrders",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FranchiseSignupCodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FranchisorCompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    CodeHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Scopes = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Label = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReservedBySignupOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReservedUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UsedByCompanyId = table.Column<Guid>(type: "uuid", nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FranchiseSignupCodes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FranchiseSignupCodes_CodeHash",
                table: "FranchiseSignupCodes",
                column: "CodeHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FranchiseSignupCodes_FranchisorCompanyId_CreatedAt",
                table: "FranchiseSignupCodes",
                columns: new[] { "FranchisorCompanyId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FranchiseSignupCodes");

            migrationBuilder.DropColumn(
                name: "FranchiseConsent",
                table: "SignupOrders");

            migrationBuilder.DropColumn(
                name: "FranchiseLinkId",
                table: "SignupOrders");

            migrationBuilder.DropColumn(
                name: "FranchiseProblem",
                table: "SignupOrders");

            migrationBuilder.DropColumn(
                name: "FranchiseSignupCodeId",
                table: "SignupOrders");
        }
    }
}
