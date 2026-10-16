using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations.Platform
{
    /// <inheritdoc />
    public partial class AddProductPublicListingFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LearnMoreUrl",
                table: "Products",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PublicDescription",
                table: "Products",
                type: "character varying(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PublicTagline",
                table: "Products",
                type: "character varying(140)",
                maxLength: 140,
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "Products"
                SET "PublicTagline" = 'Billing, jobs and staff for car spas',
                    "PublicDescription" = 'Complete auto detailing software with billing, job cards, staff commissions and WhatsApp.',
                    "LearnMoreUrl" = 'https://trovotechsolutions.in/products/baylior/'
                WHERE "Key" = 'carspa' AND "PublicTagline" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LearnMoreUrl",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "PublicDescription",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "PublicTagline",
                table: "Products");
        }
    }
}
