using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddShowroomDailyBillAndPayment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ShowroomDailyBills",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ShowroomId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShowroomDailyBills", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShowroomDailyBills_Showrooms_ShowroomId",
                        column: x => x.ShowroomId,
                        principalTable: "Showrooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ShowroomPayments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ShowroomDailyBillId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PaymentMethod = table.Column<int>(type: "integer", nullable: false),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PaymentDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShowroomPayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShowroomPayments_ShowroomDailyBills_ShowroomDailyBillId",
                        column: x => x.ShowroomDailyBillId,
                        principalTable: "ShowroomDailyBills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomDailyBills_ShowroomId_Date",
                table: "ShowroomDailyBills",
                columns: new[] { "ShowroomId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomPayments_ShowroomDailyBillId",
                table: "ShowroomPayments",
                column: "ShowroomDailyBillId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShowroomPayments");

            migrationBuilder.DropTable(
                name: "ShowroomDailyBills");
        }
    }
}
