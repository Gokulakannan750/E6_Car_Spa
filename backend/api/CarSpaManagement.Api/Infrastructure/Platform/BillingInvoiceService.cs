using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>
/// Trovo's invoices to companies for the software: numbering (TROVO/2026-27/0001, per Indian financial year),
/// lines from the plan and add-ons, and totals. GST is added only once Trovo has a GSTIN; issued invoices never change.
/// </summary>
public sealed class BillingInvoiceService(PlatformDbContext catalog, IOptions<PlatformOptions> options)
{
    private static readonly TimeZoneInfo India = TimeZoneInfo.FindSystemTimeZoneById(
        OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata");

    /// <summary>
    /// Builds and saves an open invoice for one billing period of a subscription. The subscription must be loaded
    /// with its plan version (and plan) and items (with add-on prices and add-ons).
    /// </summary>
    public async Task<BillingInvoice> CreateForPeriodAsync(Subscription subscription, DateTime periodStart, DateTime periodEnd,
        CancellationToken cancellationToken = default)
    {
        var version = subscription.PlanVersion ?? throw new InvalidOperationException("The subscription's plan version is not loaded.");
        var account = await catalog.BillingAccounts.FirstAsync(b => b.Id == subscription.BillingAccountId, cancellationToken);
        var now = DateTime.UtcNow;

        var invoice = new BillingInvoice
        {
            Id = Guid.NewGuid(),
            CompanyId = subscription.CompanyId,
            SubscriptionId = subscription.Id,
            BillingAccountId = account.Id,
            Currency = version.Currency,
            Status = BillingInvoiceStatus.Open,
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            IssuedAt = now,
            DueAt = periodStart > now ? periodStart : now,
            BillToName = account.BillingName,
            BillToAddress = account.BillingAddress,
            BillToGstin = account.Gstin,
            CreatedAt = now
        };

        var periodText = $"{ToIndia(periodStart):dd MMM yyyy} – {ToIndia(periodEnd).AddDays(-1):dd MMM yyyy}";
        var sort = 0;
        var planName = version.Plan?.Name ?? "Plan";
        var licences = subscription.Licences;
        // The plan line: its company fee, or the whole price for a subscription from before per-app licences.
        if (version.PriceMinor > 0 || licences.Total == 0)
        {
            invoice.Lines.Add(Line(invoice.Id, $"{planName} plan ({Describe(version.Interval)}), {periodText}", 1, version.PriceMinor, sort++));
        }
        foreach (var (access, label) in new[] { (AppAccess.Both, "Windows + Android"), (AppAccess.Windows, "Windows"), (AppAccess.Android, "Android") })
        {
            var count = licences.Of(access);
            if (count == 0) continue;
            invoice.Lines.Add(Line(invoice.Id, $"{label} user licence, {planName} ({Describe(version.Interval)}), {periodText}",
                count, version.UserPriceMinor(access), sort++));
        }

        // Add-ons in name order, so the same subscription always gives the same invoice.
        foreach (var item in subscription.Items.Where(i => i.EffectiveTo is null || i.EffectiveTo > periodStart)
                     .OrderBy(i => i.AddOnPrice?.AddOn?.Name, StringComparer.OrdinalIgnoreCase))
        {
            var price = item.AddOnPrice ?? throw new InvalidOperationException("Subscription item prices are not loaded.");
            if (price.Currency != version.Currency)
            {
                throw new InvalidOperationException("All lines of an invoice must use the same currency.");
            }
            invoice.Lines.Add(Line(invoice.Id, $"{price.AddOn?.Name ?? "Add-on"} ({Describe(price.Interval)})", item.Quantity, price.UnitPriceMinor, sort++));
        }

        ApplyTotals(invoice, options.Value);
        await using var transaction = catalog.Database.CurrentTransaction is null
            ? await catalog.Database.BeginTransactionAsync(cancellationToken)
            : null;
        invoice.InvoiceNumber = await NextNumberAsync(now, cancellationToken);
        catalog.BillingInvoices.Add(invoice);
        await catalog.SaveChangesAsync(cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return invoice;
    }

    /// <summary>Subtotal, GST (only when Trovo has a GSTIN) and total, all in minor units.</summary>
    public static void ApplyTotals(BillingInvoice invoice, PlatformOptions settings)
    {
        invoice.SubtotalMinor = invoice.Lines.Sum(l => l.AmountMinor);
        if (settings.ChargesGst)
        {
            invoice.TaxRatePercent = settings.GstRatePercent;
            invoice.TaxMinor = (long)Math.Round(invoice.SubtotalMinor * settings.GstRatePercent / 100m, MidpointRounding.AwayFromZero);
        }
        else
        {
            invoice.TaxRatePercent = null;
            invoice.TaxMinor = 0;
        }
        invoice.TotalMinor = invoice.SubtotalMinor + invoice.TaxMinor;
        invoice.AmountDueMinor = invoice.TotalMinor;
    }

    /// <summary>The Indian financial year of a moment, e.g. "2026-27" for any date from 1 Apr 2026 to 31 Mar 2027.</summary>
    public static string FinancialYear(DateTime utc)
    {
        var local = ToIndia(utc);
        var startYear = local.Month >= 4 ? local.Year : local.Year - 1;
        return $"{startYear}-{(startYear + 1) % 100:00}";
    }

    /// <summary>The next invoice number of the financial year. The counter row is locked so numbers never repeat.</summary>
    private async Task<string> NextNumberAsync(DateTime issuedAt, CancellationToken cancellationToken)
    {
        var year = FinancialYear(issuedAt);
        var key = $"invoice:{year}";
        await catalog.Database.ExecuteSqlInterpolatedAsync(
            $"""INSERT INTO "PlatformCounters" ("Key", "Value") VALUES ({key}, 0) ON CONFLICT ("Key") DO NOTHING""", cancellationToken);
        // Not composed further (an UPDATE cannot be wrapped in a SELECT), so read the single row in memory.
        var next = (await catalog.Database
            .SqlQuery<long>($"""UPDATE "PlatformCounters" SET "Value" = "Value" + 1 WHERE "Key" = {key} RETURNING "Value" AS "Value" """)
            .ToListAsync(cancellationToken)).Single();
        return $"{options.Value.InvoicePrefix}/{year}/{next:0000}";
    }

    private static BillingInvoiceLine Line(Guid invoiceId, string description, int quantity, long unitMinor, int sort) => new()
    {
        Id = Guid.NewGuid(),
        BillingInvoiceId = invoiceId,
        Description = description,
        Quantity = quantity,
        UnitPriceMinor = unitMinor,
        AmountMinor = unitMinor * quantity,
        SortOrder = sort
    };

    private static string Describe(BillingInterval interval) => interval == BillingInterval.Year ? "yearly" : "monthly";

    private static DateTime ToIndia(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), India);
}
