using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSpaManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class FranchiseFinancialTotals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The one place where a franchisor reads another company's figures. It returns totals and a daily series
            // only (never individual records), and only while the database itself finds an ACTIVE link from the
            // current company (app.current_org) to that company with "financial_totals" GRANTED. Row-level security
            // is lifted just for the figures query inside the function, and switched off again before it returns.
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION franchise_financial_totals(p_franchisee uuid, p_from date, p_to date)
                RETURNS jsonb
                LANGUAGE plpgsql
                SECURITY DEFINER
                SET search_path = public
                AS $fn$
                DECLARE
                    v_me uuid := NULLIF(current_setting('app.current_org', true), '')::uuid;
                    v_result jsonb;
                BEGIN
                    IF v_me IS NULL OR p_franchisee IS NULL OR NOT EXISTS (
                        SELECT 1
                        FROM "FranchiseLinks" l
                        JOIN "FranchiseLinkScopes" s ON s."FranchiseLinkId" = l."Id"
                        WHERE l."FranchisorOrganizationId" = v_me
                          AND l."FranchiseeOrganizationId" = p_franchisee
                          AND l."Status" = 'Active' AND NOT l."IsDeleted"
                          AND s."Scope" = 'financial_totals' AND s."Status" = 'Granted' AND NOT s."IsDeleted")
                    THEN
                        RAISE EXCEPTION 'There is no approved franchise link for these figures.' USING ERRCODE = '42501';
                    END IF;

                    PERFORM set_config('app.bypass_rls', 'on', true);

                    WITH inv AS (
                        SELECT "InvoiceDate"::date AS d, "TotalAmount" AS total, "BalanceAmount" AS balance
                        FROM "Invoices"
                        WHERE "OrganizationId" = p_franchisee AND NOT "IsDeleted"
                          AND "Status" NOT IN (0, 4)
                          AND "InvoiceDate" >= p_from AND "InvoiceDate" <= p_to
                    ),
                    pay AS (
                        SELECT "PaymentDate"::date AS d, "Amount" AS amount
                        FROM "Payments"
                        WHERE "OrganizationId" = p_franchisee AND NOT "IsDeleted"
                          AND "PaymentDate" >= p_from::timestamptz AND "PaymentDate" < (p_to + 1)::timestamptz
                    ),
                    jc AS (
                        SELECT count(*) AS n FROM "JobCards"
                        WHERE "OrganizationId" = p_franchisee AND NOT "IsDeleted" AND "Status" <> 7
                          AND "CreatedAt" >= p_from::timestamptz AND "CreatedAt" < (p_to + 1)::timestamptz
                    ),
                    days AS (SELECT d FROM inv UNION SELECT d FROM pay),
                    daily AS (
                        SELECT days.d,
                               COALESCE((SELECT sum(total) FROM inv WHERE inv.d = days.d), 0) AS invoiced,
                               COALESCE((SELECT sum(amount) FROM pay WHERE pay.d = days.d), 0) AS collected
                        FROM days
                    )
                    SELECT jsonb_build_object(
                        'invoiceCount', (SELECT count(*) FROM inv),
                        'invoicedAmount', COALESCE((SELECT sum(total) FROM inv), 0),
                        'collectedAmount', COALESCE((SELECT sum(amount) FROM pay), 0),
                        'outstandingAmount', COALESCE((SELECT sum(balance) FROM inv WHERE balance > 0), 0),
                        'jobCardCount', (SELECT n FROM jc),
                        'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                    'date', to_char(d, 'YYYY-MM-DD'), 'invoiced', invoiced, 'collected', collected) ORDER BY d)
                                 FROM daily), '[]'::jsonb))
                    INTO v_result;

                    PERFORM set_config('app.bypass_rls', 'off', true);
                    RETURN v_result;
                END
                $fn$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS franchise_financial_totals(uuid, date, date);");
        }
    }
}
