using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Franchise;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>
/// Opens a read-only view of another company's own database, for the franchise figures and reports. The view goes
/// through the normal routing, so it connects with that company's own database login; it cannot save anything, and
/// <see cref="ReadOnlyTransactionAsync"/> additionally makes PostgreSQL refuse any change.
/// </summary>
public static class CompanyViews
{
    public static AppDbContext ReadOnly(DbContextOptions<AppDbContext> options, Guid companyId) =>
        AppDbContext.ForReadOnly(options, new FixedTenantContext(companyId));

    /// <summary>Runs <paramref name="work"/> inside a READ ONLY transaction on the view.</summary>
    public static async Task<T> ReadOnlyTransactionAsync<T>(AppDbContext view, Func<Task<T>> work, CancellationToken cancellationToken)
    {
        await using var transaction = await view.Database.BeginTransactionAsync(cancellationToken);
        await view.Database.ExecuteSqlRawAsync("SET TRANSACTION READ ONLY", cancellationToken);
        var result = await work();
        await transaction.RollbackAsync(cancellationToken);
        return result;
    }
}

/// <summary>
/// Trovo's platform: a franchisee's approved financial totals, read from the franchisee's own database. The
/// approval is checked in the catalog first (an active link where the signed-in company is the franchisor and
/// "financial totals" is allowed); only then is the franchisee's database opened, read-only, for the same totals
/// the single-database function computes.
/// </summary>
public sealed class CrossDatabaseFranchiseFigures(
    IFranchiseLinkStore links,
    ITenantContext tenant,
    DbContextOptions<AppDbContext> options) : IFranchiseFigures
{
    private const string TotalsSql = """
        WITH inv AS (
            SELECT "InvoiceDate"::date AS d, "TotalAmount" AS total, "BalanceAmount" AS balance
            FROM "Invoices"
            WHERE "OrganizationId" = {0} AND NOT "IsDeleted"
              AND "Status" NOT IN (0, 4)
              AND "InvoiceDate" >= {1} AND "InvoiceDate" <= {2}
        ),
        pay AS (
            SELECT "PaymentDate"::date AS d, "Amount" AS amount
            FROM "Payments"
            WHERE "OrganizationId" = {0} AND NOT "IsDeleted"
              AND "PaymentDate" >= {1}::timestamptz AND "PaymentDate" < ({2}::date + 1)::timestamptz
        ),
        jc AS (
            SELECT count(*) AS n FROM "JobCards"
            WHERE "OrganizationId" = {0} AND NOT "IsDeleted" AND "Status" <> 7
              AND "CreatedAt" >= {1}::timestamptz AND "CreatedAt" < ({2}::date + 1)::timestamptz
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
                     FROM daily), '[]'::jsonb))::text AS "Value"
        """;

    public async Task<FranchiseFinancialTotalsDto> GetFinancialTotalsAsync(Guid franchiseeOrganizationId, DateOnly from, DateOnly to,
        CancellationToken cancellationToken = default)
    {
        var me = tenant.OrganizationId ?? throw new ForbiddenException("No company is signed in.");
        var approved = await links.Links.AnyAsync(l =>
            l.FranchisorOrganizationId == me &&
            l.FranchiseeOrganizationId == franchiseeOrganizationId &&
            l.Status == FranchiseLinkStatus.Active &&
            l.Scopes.Any(s => s.Scope == FranchiseScopes.FinancialTotals && s.Status == FranchiseScopeStatus.Granted),
            cancellationToken);
        if (!approved)
        {
            throw new ForbiddenException("There is no approved franchise link for these figures.");
        }

        await using var view = CompanyViews.ReadOnly(options, franchiseeOrganizationId);
        var json = await CompanyViews.ReadOnlyTransactionAsync(view, async () =>
            (await view.Database
                .SqlQueryRaw<string>(TotalsSql, franchiseeOrganizationId, from, to)
                .ToListAsync(cancellationToken)).Single(), cancellationToken);
        return PostgresFranchiseFigures.Parse(json);
    }
}
