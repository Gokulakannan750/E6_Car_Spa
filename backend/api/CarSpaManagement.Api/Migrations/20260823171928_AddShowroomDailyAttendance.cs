using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddShowroomDailyAttendance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ShowroomDailyAttendances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ShowroomId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsAttendanceConfirmed = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    AttendanceConfirmedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AttendanceConfirmedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShowroomDailyAttendances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShowroomDailyAttendances_Showrooms_ShowroomId",
                        column: x => x.ShowroomId,
                        principalTable: "Showrooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ShowroomDailyAttendances_Users_AttendanceConfirmedByUserId",
                        column: x => x.AttendanceConfirmedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomDailyAttendances_AttendanceConfirmedByUserId",
                table: "ShowroomDailyAttendances",
                column: "AttendanceConfirmedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomDailyAttendances_ShowroomId_Date",
                table: "ShowroomDailyAttendances",
                columns: new[] { "ShowroomId", "Date" },
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShowroomDailyAttendances");
        }
    }
}
