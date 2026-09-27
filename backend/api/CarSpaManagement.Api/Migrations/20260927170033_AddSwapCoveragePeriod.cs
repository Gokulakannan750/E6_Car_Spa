using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSwapCoveragePeriod : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CoverageDurationHours",
                table: "ShowroomStaffSwaps",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CoverageEndTime",
                table: "ShowroomStaffSwaps",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CoverageStartTime",
                table: "ShowroomStaffSwaps",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CoverageDurationHours",
                table: "ShowroomStaffSwaps");

            migrationBuilder.DropColumn(
                name: "CoverageEndTime",
                table: "ShowroomStaffSwaps");

            migrationBuilder.DropColumn(
                name: "CoverageStartTime",
                table: "ShowroomStaffSwaps");
        }
    }
}
