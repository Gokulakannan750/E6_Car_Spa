using System;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260925130000_AddShowroomOperationsAndVehicleWork")]
    public partial class AddShowroomOperationsAndVehicleWork : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Create ShowroomVehicleTypes Table
            migrationBuilder.CreateTable(
                name: "ShowroomVehicleTypes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShowroomVehicleTypes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomVehicleTypes_Code",
                table: "ShowroomVehicleTypes",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            // 2. Create ShowroomWorkTypes Table
            migrationBuilder.CreateTable(
                name: "ShowroomWorkTypes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShowroomWorkTypes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomWorkTypes_Code",
                table: "ShowroomWorkTypes",
                column: "Code",
                unique: true,
                filter: "\"IsDeleted\" = false");

            // 3. Add DefaultShowroomId to Staff
            migrationBuilder.AddColumn<Guid>(
                name: "DefaultShowroomId",
                table: "Staff",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Staff_DefaultShowroomId",
                table: "Staff",
                column: "DefaultShowroomId");

            migrationBuilder.AddForeignKey(
                name: "FK_Staff_Showrooms_DefaultShowroomId",
                table: "Staff",
                column: "DefaultShowroomId",
                principalTable: "Showrooms",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // 4. Create ShowroomStaffWorkSessions Table
            migrationBuilder.CreateTable(
                name: "ShowroomStaffWorkSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    HomeShowroomId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkingShowroomId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SessionType = table.Column<int>(type: "integer", nullable: false),
                    AttendanceStatus = table.Column<int>(type: "integer", nullable: false),
                    StartTime = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    EndTime = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    TransferReason = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShowroomStaffWorkSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShowroomStaffWorkSessions_Staff_StaffId",
                        column: x => x.StaffId,
                        principalTable: "Staff",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShowroomStaffWorkSessions_Showrooms_HomeShowroomId",
                        column: x => x.HomeShowroomId,
                        principalTable: "Showrooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShowroomStaffWorkSessions_Showrooms_WorkingShowroomId",
                        column: x => x.WorkingShowroomId,
                        principalTable: "Showrooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffWorkSessions_WorkingShowroomId_Date",
                table: "ShowroomStaffWorkSessions",
                columns: new[] { "WorkingShowroomId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffWorkSessions_StaffId_Date",
                table: "ShowroomStaffWorkSessions",
                columns: new[] { "StaffId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffWorkSessions_HomeShowroomId",
                table: "ShowroomStaffWorkSessions",
                column: "HomeShowroomId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffWorkSessions_StaffId",
                table: "ShowroomStaffWorkSessions",
                column: "StaffId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffWorkSessions_WorkingShowroomId",
                table: "ShowroomStaffWorkSessions",
                column: "WorkingShowroomId");

            // 5. Create ShowroomVehicleWorks Table
            migrationBuilder.CreateTable(
                name: "ShowroomVehicleWorks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ShowroomId = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    VehicleTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ShowroomStaffWorkSessionId = table.Column<Guid>(type: "uuid", nullable: true),
                    VehicleQuantity = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TimeRecorded = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShowroomVehicleWorks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShowroomVehicleWorks_Showrooms_ShowroomId",
                        column: x => x.ShowroomId,
                        principalTable: "Showrooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ShowroomVehicleWorks_Staff_StaffId",
                        column: x => x.StaffId,
                        principalTable: "Staff",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShowroomVehicleWorks_ShowroomVehicleTypes_VehicleTypeId",
                        column: x => x.VehicleTypeId,
                        principalTable: "ShowroomVehicleTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShowroomVehicleWorks_ShowroomStaffWorkSessions_ShowroomStaffWorkSessionId",
                        column: x => x.ShowroomStaffWorkSessionId,
                        principalTable: "ShowroomStaffWorkSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomVehicleWorks_ShowroomId_Date",
                table: "ShowroomVehicleWorks",
                columns: new[] { "ShowroomId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomVehicleWorks_StaffId_Date",
                table: "ShowroomVehicleWorks",
                columns: new[] { "StaffId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomVehicleWorks_ShowroomId",
                table: "ShowroomVehicleWorks",
                column: "ShowroomId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomVehicleWorks_StaffId",
                table: "ShowroomVehicleWorks",
                column: "StaffId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomVehicleWorks_VehicleTypeId",
                table: "ShowroomVehicleWorks",
                column: "VehicleTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomVehicleWorks_ShowroomStaffWorkSessionId",
                table: "ShowroomVehicleWorks",
                column: "ShowroomStaffWorkSessionId");

            // 6. Create ShowroomVehicleWorkItems Table
            migrationBuilder.CreateTable(
                name: "ShowroomVehicleWorkItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ShowroomVehicleWorkId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShowroomVehicleWorkItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShowroomVehicleWorkItems_ShowroomVehicleWorks_ShowroomVehicleWorkId",
                        column: x => x.ShowroomVehicleWorkId,
                        principalTable: "ShowroomVehicleWorks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ShowroomVehicleWorkItems_ShowroomWorkTypes_WorkTypeId",
                        column: x => x.WorkTypeId,
                        principalTable: "ShowroomWorkTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomVehicleWorkItems_ShowroomVehicleWorkId_WorkTypeId",
                table: "ShowroomVehicleWorkItems",
                columns: new[] { "ShowroomVehicleWorkId", "WorkTypeId" });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomVehicleWorkItems_ShowroomVehicleWorkId",
                table: "ShowroomVehicleWorkItems",
                column: "ShowroomVehicleWorkId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomVehicleWorkItems_WorkTypeId",
                table: "ShowroomVehicleWorkItems",
                column: "WorkTypeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShowroomVehicleWorkItems");

            migrationBuilder.DropTable(
                name: "ShowroomVehicleWorks");

            migrationBuilder.DropTable(
                name: "ShowroomStaffWorkSessions");

            migrationBuilder.DropForeignKey(
                name: "FK_Staff_Showrooms_DefaultShowroomId",
                table: "Staff");

            migrationBuilder.DropIndex(
                name: "IX_Staff_DefaultShowroomId",
                table: "Staff");

            migrationBuilder.DropColumn(
                name: "DefaultShowroomId",
                table: "Staff");

            migrationBuilder.DropTable(
                name: "ShowroomWorkTypes");

            migrationBuilder.DropTable(
                name: "ShowroomVehicleTypes");
        }
    }
}
