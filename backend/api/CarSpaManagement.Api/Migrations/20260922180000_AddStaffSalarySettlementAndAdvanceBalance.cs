using System;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260922180000_AddStaffSalarySettlementAndAdvanceBalance")]
    public partial class AddStaffSalarySettlementAndAdvanceBalance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Create StaffSalarySettlements table
            migrationBuilder.CreateTable(
                name: "StaffSalarySettlements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    PeriodFrom = table.Column<DateTime>(type: "date", nullable: false),
                    PeriodTo = table.Column<DateTime>(type: "date", nullable: false),
                    EnteredSalary = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    OutstandingAdvanceBeforeSettlement = table.Column<decimal>(type: "numeric(18,2)", nullable: false, defaultValue: 0m),
                    AdvanceDeduction = table.Column<decimal>(type: "numeric(18,2)", nullable: false, defaultValue: 0m),
                    RemainingAdvanceAfterSettlement = table.Column<decimal>(type: "numeric(18,2)", nullable: false, defaultValue: 0m),
                    FinalSalary = table.Column<decimal>(type: "numeric(18,2)", nullable: false, defaultValue: 0m),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Ready"),
                    SettledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SettledByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffSalarySettlements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StaffSalarySettlements_Staff_StaffId",
                        column: x => x.StaffId,
                        principalTable: "Staff",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StaffSalarySettlements_Users_SettledByUserId",
                        column: x => x.SettledByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            // 2. Add BalanceAmount and StaffSalarySettlementId to StaffAdvances
            migrationBuilder.AddColumn<decimal>(
                name: "BalanceAmount",
                table: "StaffAdvances",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "StaffSalarySettlementId",
                table: "StaffAdvances",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_StaffAdvances_StaffSalarySettlementId",
                table: "StaffAdvances",
                column: "StaffSalarySettlementId");

            migrationBuilder.AddForeignKey(
                name: "FK_StaffAdvances_StaffSalarySettlements_StaffSalarySettlementId",
                table: "StaffAdvances",
                column: "StaffSalarySettlementId",
                principalTable: "StaffSalarySettlements",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // 3. Unique Index preventing duplicate settlements for the same staff and period
            migrationBuilder.CreateIndex(
                name: "IX_StaffSalarySettlements_StaffId_PeriodFrom_PeriodTo",
                table: "StaffSalarySettlements",
                columns: new[] { "StaffId", "PeriodFrom", "PeriodTo" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_StaffSalarySettlements_PeriodFrom",
                table: "StaffSalarySettlements",
                column: "PeriodFrom");

            migrationBuilder.CreateIndex(
                name: "IX_StaffSalarySettlements_PeriodTo",
                table: "StaffSalarySettlements",
                column: "PeriodTo");

            migrationBuilder.CreateIndex(
                name: "IX_StaffSalarySettlements_Status",
                table: "StaffSalarySettlements",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_StaffSalarySettlements_SettledByUserId",
                table: "StaffSalarySettlements",
                column: "SettledByUserId");

            // 4. Initialize BalanceAmount safely on existing records based on real status string
            migrationBuilder.Sql("UPDATE \"StaffAdvances\" SET \"BalanceAmount\" = \"Amount\" WHERE \"Status\" = 'Outstanding';");
            migrationBuilder.Sql("UPDATE \"StaffAdvances\" SET \"BalanceAmount\" = 0 WHERE \"Status\" = 'Settled';");
            migrationBuilder.Sql("UPDATE \"StaffAdvances\" SET \"BalanceAmount\" = 0 WHERE \"Status\" = 'Obsolete';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StaffAdvances_StaffSalarySettlements_StaffSalarySettlementId",
                table: "StaffAdvances");

            migrationBuilder.DropIndex(
                name: "IX_StaffAdvances_StaffSalarySettlementId",
                table: "StaffAdvances");

            migrationBuilder.DropColumn(
                name: "StaffSalarySettlementId",
                table: "StaffAdvances");

            migrationBuilder.DropColumn(
                name: "BalanceAmount",
                table: "StaffAdvances");

            migrationBuilder.DropTable(
                name: "StaffSalarySettlements");
        }
    }
}
