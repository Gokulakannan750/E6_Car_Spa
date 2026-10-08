using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBusinessProfileTaglineAndBrandColor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BrandColor",
                table: "BusinessProfiles",
                type: "character varying(7)",
                maxLength: 7,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Tagline",
                table: "BusinessProfiles",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            // Documents used to carry a tagline, terms and a red accent that were built into the code. They are now read
            // from the company profile, so an installation that already has a profile keeps exactly what it has been
            // printing: the old built-in values are copied into its row once (only where nothing is set yet). A new
            // database has no profile row when this runs and therefore starts with none of it.
            migrationBuilder.Sql(
                "UPDATE \"BusinessProfiles\" SET \"Tagline\" = 'Premium Auto Detailing & Car Care Solutions' WHERE \"Tagline\" IS NULL;");
            migrationBuilder.Sql(
                "UPDATE \"BusinessProfiles\" SET \"BrandColor\" = '#A11A1A' WHERE \"BrandColor\" IS NULL;");
            migrationBuilder.Sql(
                "UPDATE \"BusinessProfiles\" SET \"TermsAndConditions\" = " +
                "'1. Payment is due upon completion of vehicle detailing services.' || chr(10) || " +
                "'2. Goods/services once provided are non-refundable.' || chr(10) || " +
                "'3. Please inspect your vehicle thoroughly prior to delivery handover.' " +
                "WHERE \"TermsAndConditions\" IS NULL OR btrim(\"TermsAndConditions\") = '';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BrandColor",
                table: "BusinessProfiles");

            migrationBuilder.DropColumn(
                name: "Tagline",
                table: "BusinessProfiles");
        }
    }
}
