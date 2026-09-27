using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddShowroomStaffSwaps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "OriginalShowroomId",
                table: "ShowroomStaffWorkSessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "StaffSwapId",
                table: "ShowroomStaffWorkSessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SwapId",
                table: "ShowroomStaffWorkSessions",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SwappedWithStaffId",
                table: "ShowroomStaffWorkSessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ShowroomStaffSwaps",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SwapId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StaffAId = table.Column<Guid>(type: "uuid", nullable: false),
                    ShowroomAId = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffBId = table.Column<Guid>(type: "uuid", nullable: false),
                    ShowroomBId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionAId = table.Column<Guid>(type: "uuid", nullable: true),
                    SessionBId = table.Column<Guid>(type: "uuid", nullable: true),
                    PerformedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    PerformedByName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShowroomStaffSwaps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShowroomStaffSwaps_Showrooms_ShowroomAId",
                        column: x => x.ShowroomAId,
                        principalTable: "Showrooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShowroomStaffSwaps_Showrooms_ShowroomBId",
                        column: x => x.ShowroomBId,
                        principalTable: "Showrooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShowroomStaffSwaps_Staff_StaffAId",
                        column: x => x.StaffAId,
                        principalTable: "Staff",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShowroomStaffSwaps_Staff_StaffBId",
                        column: x => x.StaffBId,
                        principalTable: "Staff",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShowroomStaffSwaps_Users_PerformedByUserId",
                        column: x => x.PerformedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffWorkSessions_OriginalShowroomId",
                table: "ShowroomStaffWorkSessions",
                column: "OriginalShowroomId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffWorkSessions_StaffSwapId",
                table: "ShowroomStaffWorkSessions",
                column: "StaffSwapId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffWorkSessions_SwappedWithStaffId",
                table: "ShowroomStaffWorkSessions",
                column: "SwappedWithStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffSwaps_PerformedByUserId",
                table: "ShowroomStaffSwaps",
                column: "PerformedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffSwaps_ShowroomAId_Date",
                table: "ShowroomStaffSwaps",
                columns: new[] { "ShowroomAId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffSwaps_ShowroomBId_Date",
                table: "ShowroomStaffSwaps",
                columns: new[] { "ShowroomBId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffSwaps_StaffAId_Date",
                table: "ShowroomStaffSwaps",
                columns: new[] { "StaffAId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffSwaps_StaffBId_Date",
                table: "ShowroomStaffSwaps",
                columns: new[] { "StaffBId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_ShowroomStaffSwaps_SwapId",
                table: "ShowroomStaffSwaps",
                column: "SwapId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ShowroomStaffWorkSessions_ShowroomStaffSwaps_StaffSwapId",
                table: "ShowroomStaffWorkSessions",
                column: "StaffSwapId",
                principalTable: "ShowroomStaffSwaps",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ShowroomStaffWorkSessions_Showrooms_OriginalShowroomId",
                table: "ShowroomStaffWorkSessions",
                column: "OriginalShowroomId",
                principalTable: "Showrooms",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ShowroomStaffWorkSessions_Staff_SwappedWithStaffId",
                table: "ShowroomStaffWorkSessions",
                column: "SwappedWithStaffId",
                principalTable: "Staff",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ShowroomStaffWorkSessions_ShowroomStaffSwaps_StaffSwapId",
                table: "ShowroomStaffWorkSessions");

            migrationBuilder.DropForeignKey(
                name: "FK_ShowroomStaffWorkSessions_Showrooms_OriginalShowroomId",
                table: "ShowroomStaffWorkSessions");

            migrationBuilder.DropForeignKey(
                name: "FK_ShowroomStaffWorkSessions_Staff_SwappedWithStaffId",
                table: "ShowroomStaffWorkSessions");

            migrationBuilder.DropTable(
                name: "ShowroomStaffSwaps");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomStaffWorkSessions_OriginalShowroomId",
                table: "ShowroomStaffWorkSessions");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomStaffWorkSessions_StaffSwapId",
                table: "ShowroomStaffWorkSessions");

            migrationBuilder.DropIndex(
                name: "IX_ShowroomStaffWorkSessions_SwappedWithStaffId",
                table: "ShowroomStaffWorkSessions");

            migrationBuilder.DropColumn(
                name: "OriginalShowroomId",
                table: "ShowroomStaffWorkSessions");

            migrationBuilder.DropColumn(
                name: "StaffSwapId",
                table: "ShowroomStaffWorkSessions");

            migrationBuilder.DropColumn(
                name: "SwapId",
                table: "ShowroomStaffWorkSessions");

            migrationBuilder.DropColumn(
                name: "SwappedWithStaffId",
                table: "ShowroomStaffWorkSessions");
        }
    }
}
