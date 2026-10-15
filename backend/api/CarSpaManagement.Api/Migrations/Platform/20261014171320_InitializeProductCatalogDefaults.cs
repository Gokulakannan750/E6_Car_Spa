using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations.Platform
{
    /// <inheritdoc />
    public partial class InitializeProductCatalogDefaults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Before generic products, every registered product was the Car Spa runtime
            // (including its configured aliases). Repair the blank metadata left by
            // GenericProductCatalog in SQL, before EF materializes the enum.
            migrationBuilder.Sql("""
                UPDATE "Products"
                SET "Capabilities" = CASE
                        WHEN "SeatModel" = '' AND "Capabilities" = '' THEN 'franchise'
                        ELSE "Capabilities" END,
                    "SeatModel" = CASE WHEN "SeatModel" = '' THEN 'PerType' ELSE "SeatModel" END,
                    "TrialPlanCode" = CASE WHEN "TrialPlanCode" = '' THEN 'professional' ELSE "TrialPlanCode" END,
                    "DatabasePrefix" = CASE WHEN "DatabasePrefix" = '' THEN "Key" ELSE "DatabasePrefix" END;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "TrialPlanCode",
                table: "Products",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "professional",
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "SeatModel",
                table: "Products",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "None",
                oldClrType: typeof(string),
                oldType: "character varying(10)",
                oldMaxLength: 10);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "TrialPlanCode",
                table: "Products",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50,
                oldDefaultValue: "professional");

            migrationBuilder.AlterColumn<string>(
                name: "SeatModel",
                table: "Products",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(10)",
                oldMaxLength: 10,
                oldDefaultValue: "None");
        }
    }
}
