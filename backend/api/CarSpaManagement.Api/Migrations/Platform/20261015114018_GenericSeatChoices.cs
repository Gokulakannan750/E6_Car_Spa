using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations.Platform
{
    /// <inheritdoc />
    public partial class GenericSeatChoices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SeatsQuoteJson",
                table: "SignupOrders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SeatsJson",
                table: "PlanChangeRequests",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SeatsQuoteJson",
                table: "SignupOrders");

            migrationBuilder.DropColumn(
                name: "SeatsJson",
                table: "PlanChangeRequests");
        }
    }
}
