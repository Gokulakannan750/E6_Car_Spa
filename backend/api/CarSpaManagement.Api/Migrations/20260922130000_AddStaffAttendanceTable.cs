using System;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260922130000_AddStaffAttendanceTable")]
    public partial class AddStaffAttendanceTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StaffAttendances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttendanceDate = table.Column<DateTime>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Present"),
                    CheckInTime = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    CheckOutTime = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffAttendances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StaffAttendances_Staff_StaffId",
                        column: x => x.StaffId,
                        principalTable: "Staff",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StaffAttendances_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_StaffAttendances_Users_UpdatedByUserId",
                        column: x => x.UpdatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StaffAttendances_StaffId_AttendanceDate_Unique",
                table: "StaffAttendances",
                columns: new[] { "StaffId", "AttendanceDate" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_StaffAttendances_AttendanceDate",
                table: "StaffAttendances",
                column: "AttendanceDate");

            migrationBuilder.CreateIndex(
                name: "IX_StaffAttendances_StaffId",
                table: "StaffAttendances",
                column: "StaffId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffAttendances_Status",
                table: "StaffAttendances",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_StaffAttendances_CreatedByUserId",
                table: "StaffAttendances",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffAttendances_UpdatedByUserId",
                table: "StaffAttendances",
                column: "UpdatedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StaffAttendances");
        }
    }
}
