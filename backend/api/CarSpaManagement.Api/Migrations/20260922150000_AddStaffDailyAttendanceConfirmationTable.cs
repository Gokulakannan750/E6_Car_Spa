using System;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260922150000_AddStaffDailyAttendanceConfirmationTable")]
    public partial class AddStaffDailyAttendanceConfirmationTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Migrate any historical Absent records to Leave safely
            migrationBuilder.Sql("UPDATE \"StaffAttendances\" SET \"Status\" = 'Leave' WHERE \"Status\" = 'Absent';");

            migrationBuilder.CreateTable(
                name: "StaffDailyAttendanceConfirmations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateTime>(type: "date", nullable: false),
                    IsAttendanceConfirmed = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    AttendanceConfirmedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AttendanceConfirmedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffDailyAttendanceConfirmations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StaffDailyAttendanceConfirmations_Users_AttendanceConfirmedByUserId",
                        column: x => x.AttendanceConfirmedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StaffDailyAttendanceConfirmations_Date",
                table: "StaffDailyAttendanceConfirmations",
                column: "Date",
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StaffDailyAttendanceConfirmations");
        }
    }
}
