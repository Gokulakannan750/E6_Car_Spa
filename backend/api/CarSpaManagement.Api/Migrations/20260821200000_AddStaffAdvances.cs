using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace CarSpaManagement.Api.Migrations;

public partial class AddStaffAdvances : Migration
{
 protected override void Up(MigrationBuilder migrationBuilder)
 {
 migrationBuilder.CreateTable(
 name: "Staff",
 columns: table => new
 {
 Id = table.Column<Guid>(type: "uuid", nullable: false),
 Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
 PhoneNumber = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
 Email = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
 Address = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
 Role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
 IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
 CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
 UpdatedAt = table.Column<DateTime?>(type: "timestamp with time zone", nullable: true),
 IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
 },
 constraints: table =>
 {
 table.PrimaryKey("PK_Staff", x => x.Id);
 });

 migrationBuilder.CreateTable(
 name: "StaffAdvances",
 columns: table => new
 {
 Id = table.Column<Guid>(type: "uuid", nullable: false),
 StaffId = table.Column<Guid>(type: "uuid", nullable: false),
 StaffName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
 StaffRole = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
 AdvanceType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
 Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
 Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
 AdvanceDate = table.Column<DateTime>(type: "date", nullable: false),
 PaymentMethod = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
 Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Pending"),
 Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
 CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
 UpdatedAt = table.Column<DateTime?>(type: "timestamp with time zone", nullable: true),
 IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
 },
 constraints: table =>
 {
 table.PrimaryKey("PK_StaffAdvances", x => x.Id);
 });

 migrationBuilder.CreateIndex(
 name: "IX_Staff_PhoneNumber",
 table: "Staff",
 column: "PhoneNumber",
 unique: true);

 migrationBuilder.CreateIndex(
 name: "IX_StaffAdvances_AdvanceDate",
 table: "StaffAdvances",
 column: "AdvanceDate");

 migrationBuilder.CreateIndex(
 name: "IX_StaffAdvances_StaffId",
 table: "StaffAdvances",
 column: "StaffId");

 migrationBuilder.CreateIndex(
 name: "IX_StaffAdvances_Status",
 table: "StaffAdvances",
 column: "Status");

 migrationBuilder.AddForeignKey(
 name: "FK_StaffAdvances_Staff_StaffId",
 table: "StaffAdvances",
 column: "StaffId",
 principalTable: "Staff",
 principalColumn: "Id",
 onDelete: ReferentialAction.Restrict);
 }

 protected override void Down(MigrationBuilder migrationBuilder)
 {
 migrationBuilder.DropTable(
 name: "StaffAdvances");

 migrationBuilder.DropTable(
 name: "Staff");
 }
}
