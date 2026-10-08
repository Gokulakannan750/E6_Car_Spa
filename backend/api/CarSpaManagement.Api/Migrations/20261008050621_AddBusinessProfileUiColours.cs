using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBusinessProfileUiColours : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AppColor",
                table: "BusinessProfiles",
                type: "character varying(7)",
                maxLength: 7,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SidebarColor",
                table: "BusinessProfiles",
                type: "character varying(7)",
                maxLength: 7,
                nullable: true);

            // The existing installation's sidebar and login page have always been deep red; keep that look.
            // A database with no profile row yet (a new company) is left empty and gets the neutral default.
            migrationBuilder.Sql("UPDATE \"BusinessProfiles\" SET \"SidebarColor\" = '#A11A1A' WHERE \"SidebarColor\" IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AppColor",
                table: "BusinessProfiles");

            migrationBuilder.DropColumn(
                name: "SidebarColor",
                table: "BusinessProfiles");
        }
    }
}
