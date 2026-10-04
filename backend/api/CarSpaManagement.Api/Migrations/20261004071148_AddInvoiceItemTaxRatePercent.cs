using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceItemTaxRatePercent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "TaxRatePercent",
                table: "InvoiceItems",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            // Backfill the rate that was actually applied to existing lines (the Phase 0 rule: 0 on non-GST invoices,
            // 18% for outside-job lines, otherwise the job-card line rate with 0 read as 18%). A rate is only stored
            // when it reproduces the stored tax amount exactly; any other line keeps NULL ("rate unknown") rather
            // than a guessed rate. Amounts are not touched.
            migrationBuilder.Sql("""
                UPDATE "InvoiceItems" AS ii
                SET "TaxRatePercent" = c.rate
                FROM (
                    SELECT line."Id",
                        CASE
                            WHEN NOT inv."IsGstEnabled" THEN 0
                            WHEN line."OutsideJobId" IS NOT NULL OR line."ServiceId" IS NULL THEN 18
                            ELSE COALESCE(NULLIF((
                                SELECT jcs."TaxPercentage" FROM "JobCardServices" jcs
                                WHERE jcs."JobCardId" = inv."JobCardId" AND jcs."ServiceId" = line."ServiceId" AND NOT jcs."IsDeleted"
                                ORDER BY jcs."CreatedAt" LIMIT 1), 0), 18)
                        END AS rate,
                        line."TaxableAmount",
                        line."TaxAmount"
                    FROM "InvoiceItems" line
                    JOIN "Invoices" inv ON inv."Id" = line."InvoiceId"
                ) AS c
                WHERE ii."Id" = c."Id"
                  AND ii."TaxRatePercent" IS NULL
                  AND 2 * ROUND(c."TaxableAmount" * c.rate / 200, 2) = c."TaxAmount";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TaxRatePercent",
                table: "InvoiceItems");
        }
    }
}
