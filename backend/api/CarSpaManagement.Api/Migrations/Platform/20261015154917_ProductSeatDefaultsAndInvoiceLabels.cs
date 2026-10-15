using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations.Platform
{
    /// <inheritdoc />
    public partial class ProductSeatDefaultsAndInvoiceLabels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "DefaultSeat",
                table: "ProductSeatTypes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "InvoiceLabel",
                table: "ProductSeatTypes",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
            // Preserve the previous default/label behavior for existing catalog rows once, on upgrade.
            // Runtime selection and labels thereafter use metadata, never product-specific seat codes.
            migrationBuilder.Sql("""
                UPDATE "ProductSeatTypes" AS seat
                SET "DefaultSeat" = TRUE
                FROM "Products" AS product
                WHERE seat."ProductId" = product."Id" AND product."SeatModel" = 'PerType' AND seat."Code" = 'both';

                UPDATE "ProductSeatTypes"
                SET "InvoiceLabel" = CASE
                    WHEN "Code" = 'android' AND "Name" = 'Android only' THEN 'Android user licence'
                    WHEN "Code" = 'windows' AND "Name" = 'Windows only' THEN 'Windows user licence'
                    WHEN "Code" = 'both' AND "Name" = 'Windows + Android' THEN 'Windows + Android user licence'
                    ELSE NULL END;
                """);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DefaultSeat",
                table: "ProductSeatTypes");

            migrationBuilder.DropColumn(
                name: "InvoiceLabel",
                table: "ProductSeatTypes");
        }
    }
}
