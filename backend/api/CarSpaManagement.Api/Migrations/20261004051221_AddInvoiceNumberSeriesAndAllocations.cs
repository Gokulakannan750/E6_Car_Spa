using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <summary>
    /// Separate GST / non-GST invoice numbering.
    ///
    /// Creates InvoiceNumberSeries (one counter + prefix per series) and InvoiceNumberAllocations (permanent,
    /// append-only ledger of every number ever issued), then initialises both from the EXISTING data:
    ///   * every existing invoice number is recorded as a Legacy allocation (including cancelled and soft-deleted
    ///     invoices, and numbers replaced via INVOICE_NUMBER_CHANGED audit entries) so it can never be reused;
    ///   * the series is taken from the invoice's IsGstEnabled flag — never from the number text;
    ///   * each counter starts at (highest numeric part of that series' old-format "PREFIX-YYYY-NNNNNN"
    ///     numbers) + 1, or 1 on an empty database.
    /// Existing invoice rows are NOT modified. invoice_number_seq and BusinessProfiles.InvoicePrefix are left in
    /// place (no longer used for numbering) so that rolling back restores the previous behaviour.
    ///
    /// Note: the model snapshot now also includes InvoiceItems.OutsideJobId, which was added earlier by the
    /// hand-written migration 20260929135000 without a snapshot update; it is intentionally not re-created here.
    /// </summary>
    public partial class AddInvoiceNumberSeriesAndAllocations : Migration
    {
        private const string LegacyNumberPattern = "^[A-Za-z0-9]+-[0-9]{4}-[0-9]{1,18}$";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "InvoiceNumberAllocations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    InvoiceNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    NormalizedNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    SeriesKind = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    AllocationType = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    CounterValue = table.Column<long>(type: "bigint", nullable: true),
                    AllocatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AllocatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvoiceNumberAllocations", x => x.Id);
                    table.CheckConstraint("CK_InvoiceNumberAllocations_AllocationType", "\"AllocationType\" IN ('Legacy', 'Automatic', 'Manual')");
                    table.CheckConstraint("CK_InvoiceNumberAllocations_Normalized", "\"NormalizedNumber\" = upper(btrim(\"InvoiceNumber\"))");
                    table.CheckConstraint("CK_InvoiceNumberAllocations_SeriesKind", "\"SeriesKind\" IN ('Gst', 'NonGst')");
                    table.ForeignKey(
                        name: "FK_InvoiceNumberAllocations_Invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "Invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InvoiceNumberSeries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SeriesKind = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Prefix = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    MinDigits = table.Column<int>(type: "integer", nullable: false, defaultValue: 4),
                    NextNumber = table.Column<long>(type: "bigint", nullable: false, defaultValue: 1L),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvoiceNumberSeries", x => x.Id);
                    table.CheckConstraint("CK_InvoiceNumberSeries_MinDigits", "\"MinDigits\" BETWEEN 1 AND 9");
                    table.CheckConstraint("CK_InvoiceNumberSeries_NextNumber", "\"NextNumber\" >= 1");
                    table.CheckConstraint("CK_InvoiceNumberSeries_SeriesKind", "\"SeriesKind\" IN ('Gst', 'NonGst')");
                });

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceNumberAllocations_InvoiceId",
                table: "InvoiceNumberAllocations",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "UX_InvoiceNumberAllocations_NormalizedNumber",
                table: "InvoiceNumberAllocations",
                column: "NormalizedNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_InvoiceNumberSeries_SeriesKind",
                table: "InvoiceNumberSeries",
                column: "SeriesKind",
                unique: true,
                filter: "\"IsDeleted\" = false");

            // The two active prefixes must differ (case-insensitive).
            migrationBuilder.Sql(
                "CREATE UNIQUE INDEX \"UX_InvoiceNumberSeries_Prefix\" ON \"InvoiceNumberSeries\" (upper(\"Prefix\")) WHERE \"IsDeleted\" = false;");

            // 1. Reserve every number currently held by an invoice (any status, including soft-deleted).
            migrationBuilder.Sql($@"
INSERT INTO ""InvoiceNumberAllocations""
    (""Id"", ""InvoiceId"", ""InvoiceNumber"", ""NormalizedNumber"", ""SeriesKind"", ""AllocationType"", ""CounterValue"", ""AllocatedAtUtc"", ""AllocatedByUserId"")
SELECT gen_random_uuid(),
       i.""Id"",
       btrim(i.""InvoiceNumber""),
       upper(btrim(i.""InvoiceNumber"")),
       CASE WHEN i.""IsGstEnabled"" THEN 'Gst' ELSE 'NonGst' END,
       'Legacy',
       CASE WHEN btrim(i.""InvoiceNumber"") ~ '{LegacyNumberPattern}'
            THEN substring(btrim(i.""InvoiceNumber"") from '([0-9]+)$')::bigint END,
       COALESCE(i.""UpdatedAt"", i.""CreatedAt""),
       NULL
FROM ""Invoices"" i
WHERE i.""InvoiceNumber"" IS NOT NULL AND btrim(i.""InvoiceNumber"") <> ''
ON CONFLICT (""NormalizedNumber"") DO NOTHING;");

            // 2. Reserve numbers that were replaced by an Owner rename (recorded in the audit trail).
            migrationBuilder.Sql($@"
INSERT INTO ""InvoiceNumberAllocations""
    (""Id"", ""InvoiceId"", ""InvoiceNumber"", ""NormalizedNumber"", ""SeriesKind"", ""AllocationType"", ""CounterValue"", ""AllocatedAtUtc"", ""AllocatedByUserId"")
SELECT gen_random_uuid(),
       i.""Id"",
       old.num,
       upper(old.num),
       CASE WHEN i.""IsGstEnabled"" THEN 'Gst' ELSE 'NonGst' END,
       'Legacy',
       CASE WHEN old.num ~ '{LegacyNumberPattern}' THEN substring(old.num from '([0-9]+)$')::bigint END,
       a.""TimestampUtc"",
       NULL
FROM ""AuditLogs"" a
JOIN ""Invoices"" i ON i.""Id"" = a.""EntityId""
CROSS JOIN LATERAL (SELECT btrim(a.""OldValues""::json ->> 'invoiceNumber') AS num) old
WHERE a.""Action"" = 'INVOICE_NUMBER_CHANGED'
  AND a.""OldValues"" LIKE '{{%'
  AND old.num IS NOT NULL AND old.num <> '' AND length(old.num) <= 30
ON CONFLICT (""NormalizedNumber"") DO NOTHING;");

            // 3. One series per kind; counter continues after the highest old-format number of THAT kind.
            migrationBuilder.Sql(@"
INSERT INTO ""InvoiceNumberSeries"" (""Id"", ""SeriesKind"", ""Prefix"", ""MinDigits"", ""NextNumber"", ""CreatedAt"", ""IsDeleted"")
SELECT gen_random_uuid(), k.kind, k.prefix, 4,
       COALESCE((SELECT MAX(a.""CounterValue"") FROM ""InvoiceNumberAllocations"" a
                 WHERE a.""SeriesKind"" = k.kind AND a.""AllocationType"" = 'Legacy' AND a.""CounterValue"" IS NOT NULL), 0) + 1,
       CURRENT_TIMESTAMP, false
FROM (VALUES ('Gst', 'GST/'), ('NonGst', 'BILL/')) AS k(kind, prefix);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS \"UX_InvoiceNumberSeries_Prefix\";");

            migrationBuilder.DropTable(
                name: "InvoiceNumberAllocations");

            migrationBuilder.DropTable(
                name: "InvoiceNumberSeries");
        }
    }
}
