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
    /// with its plan version (and plan) and items (with add-on prices and add-ons). <paramref name="terms"/> replaces
    /// the subscription's own plan, licences and add-ons (a downgrade that starts with this period).
    /// </summary>
    public async Task<BillingInvoice> CreateForPeriodAsync(Subscription subscription, DateTime periodStart, DateTime periodEnd,
        CancellationToken cancellationToken = default, InvoiceTerms? terms = null)
    {
        terms ??= InvoiceTerms.Of(subscription, periodStart);
        var invoice = await NewInvoiceAsync(subscription, terms.Version.Currency, cancellationToken);
        invoice.PeriodStart = periodStart;
        invoice.PeriodEnd = periodEnd;
        invoice.DueAt = periodStart > invoice.IssuedAt ? periodStart : invoice.IssuedAt;

        var periodText = $"{ToIndia(periodStart):dd MMM yyyy} – {ToIndia(periodEnd).AddDays(-1):dd MMM yyyy}";
        var sort = 0;
        foreach (var (description, quantity, unit) in Lines(terms, periodText))
        {
            invoice.Lines.Add(Line(invoice.Id, description, quantity, unit, sort++));
        }
        return await SaveAsync(invoice, cancellationToken);
    }

    /// <summary>
    /// A one-off invoice (e.g. the price difference for the rest of a paid period after an upgrade). Paying it never
    /// changes the subscription's dates. Due in 7 days.
    /// </summary>
    public async Task<BillingInvoice> CreateAdjustmentAsync(Subscription subscription, string description, long amountMinor, string currency,
        CancellationToken cancellationToken = default)
    {
        if (amountMinor <= 0) throw new InvalidOperationException("An adjustment invoice needs an amount above zero.");
        var invoice = await NewInvoiceAsync(subscription, currency, cancellationToken);
        invoice.Kind = BillingInvoiceKind.Adjustment;
        invoice.DueAt = invoice.IssuedAt.AddDays(7);
        invoice.Lines.Add(Line(invoice.Id, description, 1, amountMinor, 0));
        return await SaveAsync(invoice, cancellationToken);
    }

    /// <summary>The price of one full period for these terms, before tax (the same lines as an invoice).</summary>
    public static long PeriodSubtotal(InvoiceTerms terms) => Lines(terms, string.Empty).Sum(l => l.Unit * l.Quantity);

    private static IEnumerable<(string Description, int Quantity, long Unit)> Lines(InvoiceTerms terms, string periodText)
    {
        var version = terms.Version;
        var planName = version.Plan?.Name ?? "Plan";
        var period = periodText.Length > 0 ? $", {periodText}" : string.Empty;
        // The plan line: its company fee, or the whole price for a subscription from before per-app licences.
        if (version.PriceMinor > 0 || (terms.Seats?.Values.Sum() ?? terms.Licences.Total) == 0)
        {
            yield return ($"{planName} plan ({Describe(version.Interval)}){period}", 1, version.PriceMinor);
        }
        var quantities = terms.Seats ?? ProductSeats.Legacy(terms.Licences);
        foreach (var price in version.SeatPrices.OrderByDescending(p => p.SeatType!.SortOrder))
        {
            var count = quantities.GetValueOrDefault(price.SeatType!.Code);
            if (count == 0) continue;
            yield return ($"{ProductSeats.InvoiceLabel(price.SeatType)}, {planName} ({Describe(version.Interval)}){period}", count, price.PriceMinor);
        }
        // Add-ons in name order, so the same subscription always gives the same invoice.
        foreach (var (price, quantity) in terms.AddOns.OrderBy(a => a.Price.AddOn?.Name, StringComparer.OrdinalIgnoreCase))
        {
            if (price.Currency != version.Currency)
            {
                throw new InvalidOperationException("All lines of an invoice must use the same currency.");
            }
            yield return ($"{price.AddOn?.Name ?? "Add-on"} ({Describe(price.Interval)})", quantity, price.UnitPriceMinor);
        }
    }

    private async Task<BillingInvoice> NewInvoiceAsync(Subscription subscription, string currency, CancellationToken cancellationToken)
    {
        var account = await catalog.BillingAccounts.FirstAsync(b => b.Id == subscription.BillingAccountId, cancellationToken);
        var now = DateTime.UtcNow;
        return new BillingInvoice
        {
            Id = Guid.NewGuid(),
            CompanyId = subscription.CompanyId,
            SubscriptionId = subscription.Id,
            BillingAccountId = account.Id,
            Currency = currency,
            Status = BillingInvoiceStatus.Open,
            IssuedAt = now,
            DueAt = now,
            BillToName = account.BillingName,
            BillToAddress = account.BillingAddress,
            BillToGstin = account.Gstin,
            CreatedAt = now
        };
    }

    private async Task<BillingInvoice> SaveAsync(BillingInvoice invoice, CancellationToken cancellationToken)
    {
        ApplyTotals(invoice, options.Value);
        await using var transaction = catalog.Database.CurrentTransaction is null
            ? await catalog.Database.BeginTransactionAsync(cancellationToken)
            : null;
        invoice.InvoiceNumber = await NextNumberAsync(invoice.IssuedAt, cancellationToken);
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

    public static DateTime ToIndia(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), India);
}

/// <summary>What one period of a subscription is billed for: the plan version, the user licences and the add-ons.</summary>
public sealed record InvoiceTerms(PlanVersion Version, LicenceCounts Licences, IReadOnlyList<(AddOnPrice Price, int Quantity)> AddOns, IReadOnlyDictionary<string, int>? Seats = null)
{
    /// <summary>The subscription's own terms for a period starting at <paramref name="periodStart"/>.</summary>
    public static InvoiceTerms Of(Subscription subscription, DateTime periodStart) => new(
        subscription.PlanVersion ?? throw new InvalidOperationException("The subscription's plan version is not loaded."),
        subscription.Licences,
        subscription.Items.Where(i => i.EffectiveTo is null || i.EffectiveTo > periodStart)
            .Select(i => (i.AddOnPrice ?? throw new InvalidOperationException("Subscription item prices are not loaded."), i.Quantity))
            .ToList(), ProductSeats.Of(subscription));
}
