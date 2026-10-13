using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>What a customer wants to buy.</summary>
public sealed record PlanChoice(string PlanCode, BillingInterval Interval, LicenceCounts Licences, IReadOnlyDictionary<string, int> AddOns);

public sealed record QuoteLine(string Description, int Quantity, long UnitPriceMinor, long AmountMinor);

/// <summary>A price worked out by the server from the prices in force now (the website only displays it).</summary>
public sealed record PriceQuote(
    string PlanCode,
    string PlanName,
    BillingInterval Interval,
    LicenceCounts Licences,
    IReadOnlyDictionary<string, int> AddOns,
    IReadOnlyList<QuoteLine> Lines,
    long SubtotalMinor,
    long TaxMinor,
    decimal? TaxRatePercent,
    long TotalMinor,
    string Currency,
    CheaperPlan? Cheaper);

/// <summary>Another plan that includes some of the chosen modules and costs less with the same licences.</summary>
public sealed record CheaperPlan(string PlanCode, string PlanName, long TotalMinor);

/// <summary>
/// Prices a plan, licences and add-ons the same way the first invoice will (one line per licence type, then the
/// add-ons). Refuses what cannot be bought: unknown or stopped plans and add-ons, too few licences, or a module the
/// plan already includes.
/// </summary>
public sealed class PriceQuoteService(PlatformDbContext catalog)
{
    private static readonly (AppAccess Access, string Label)[] LicenceTypes =
        [(AppAccess.Both, "Windows + Android"), (AppAccess.Windows, "Windows"), (AppAccess.Android, "Android")];

    public async Task<PriceQuote> QuoteAsync(Guid productId, PlanChoice choice, PlatformOptions settings, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var plans = await catalog.Plans.AsNoTracking()
            .Include(p => p.Versions).ThenInclude(v => v.Entitlements)
            .Where(p => p.ProductId == productId && p.IsActive)
            .ToListAsync(cancellationToken);
        var addOns = await catalog.AddOns.AsNoTracking().Include(a => a.Prices)
            .Where(a => a.ProductId == productId && a.IsActive)
            .ToListAsync(cancellationToken);

        var plan = plans.FirstOrDefault(p => p.Code == choice.PlanCode)
            ?? throw new ValidationException("Choose one of the plans on sale.");
        var (lines, total, currency) = Price(plan, choice, addOns, now, refuseIncluded: true);

        CheaperPlan? cheaper = null;
        foreach (var other in plans.Where(p => p.Code != plan.Code))
        {
            var version = CurrentVersion(other, choice.Interval, now);
            if (version is null) continue;
            var chosen = addOns.Where(a => choice.AddOns.TryGetValue(a.Code, out var q) && q > 0).ToList();
            if (!chosen.Any(a => SubscriptionService.PlanIncludes(version, a))) continue;
            var remaining = choice.AddOns.Where(kv => !chosen.Any(a => a.Code == kv.Key && SubscriptionService.PlanIncludes(version, a)))
                .ToDictionary(kv => kv.Key, kv => kv.Value);
            try
            {
                var (_, otherTotal, _) = Price(other, choice with { PlanCode = other.Code, AddOns = remaining }, addOns, now, refuseIncluded: true);
                if (otherTotal < total && (cheaper is null || otherTotal < cheaper.TotalMinor)) cheaper = new CheaperPlan(other.Code, other.Name, otherTotal);
            }
            catch (ValidationException)
            {
                // That plan cannot take these licences (e.g. a higher minimum); not a suggestion then.
            }
        }

        // Tax the same way invoices do (BillingInvoiceService.ApplyTotals): only once Trovo charges GST.
        var tax = settings.ChargesGst ? (long)Math.Round(total * settings.GstRatePercent / 100m, MidpointRounding.AwayFromZero) : 0;
        return new PriceQuote(plan.Code, plan.Name, choice.Interval, choice.Licences,
            choice.AddOns.Where(kv => kv.Value > 0).ToDictionary(kv => kv.Key, kv => kv.Value),
            lines, total, tax, settings.ChargesGst ? settings.GstRatePercent : null, total + tax, currency, cheaper);
    }

    private static (List<QuoteLine> Lines, long Total, string Currency) Price(Plan plan, PlanChoice choice, IReadOnlyList<AddOn> addOns,
        DateTime now, bool refuseIncluded)
    {
        var version = CurrentVersion(plan, choice.Interval, now)
            ?? throw new ValidationException($"{plan.Name} is not sold {(choice.Interval == BillingInterval.Year ? "yearly" : "monthly")}.");
        if (choice.Licences.Problem(version.IncludedSeats) is { } problem) throw new ValidationException(problem);

        var period = choice.Interval == BillingInterval.Year ? "yearly" : "monthly";
        var lines = new List<QuoteLine>();
        if (version.PriceMinor > 0) lines.Add(new QuoteLine($"{plan.Name} plan ({period})", 1, version.PriceMinor, version.PriceMinor));
        foreach (var (access, label) in LicenceTypes)
        {
            var count = choice.Licences.Of(access);
            if (count == 0) continue;
            var unit = version.UserPriceMinor(access);
            lines.Add(new QuoteLine($"{label} user licence, {plan.Name} ({period})", count, unit, unit * count));
        }

        foreach (var (code, quantity) in choice.AddOns.Where(kv => kv.Value != 0))
        {
            if (quantity is < 0 or > 100) throw new ValidationException("Add-on quantities must be 0 to 100.");
            var addOn = addOns.FirstOrDefault(a => a.Code == code) ?? throw new ValidationException($"The add-on '{code}' is not on sale.");
            if (addOn.Value == "true" && quantity > 1) throw new ValidationException($"{addOn.Name} can be added only once.");
            if (refuseIncluded && SubscriptionService.PlanIncludes(version, addOn))
            {
                throw new ValidationException($"The {plan.Name} plan already includes {addOn.Name}.");
            }
            var price = addOn.Prices.Where(p => p.Interval == choice.Interval && p.EffectiveFrom <= now && (p.EffectiveTo == null || p.EffectiveTo > now))
                .OrderByDescending(p => p.Version).FirstOrDefault()
                ?? throw new ValidationException($"{addOn.Name} is not sold {period}.");
            lines.Add(new QuoteLine($"{addOn.Name} ({period})", quantity, price.UnitPriceMinor, price.UnitPriceMinor * quantity));
        }

        return (lines, lines.Sum(l => l.AmountMinor), version.Currency);
    }

    public static PlanVersion? CurrentVersion(Plan plan, BillingInterval interval, DateTime now) =>
        plan.Versions.Where(v => v.Interval == interval && v.EffectiveFrom <= now && (v.EffectiveTo == null || v.EffectiveTo > now))
            .OrderByDescending(v => v.Version).FirstOrDefault();
}
