using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Platform.Products;
using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CarSpaManagement.Api.Infrastructure.Platform;

public sealed record PublicPricesDto(long CompanyFeeMinor, long AndroidUserPriceMinor, long WindowsUserPriceMinor, long BothUserPriceMinor);
public sealed record PublicPlanDto(string Code, string Name, int MinimumLicences, IReadOnlyList<string> Modules, PublicPricesDto? Monthly, PublicPricesDto? Yearly);
public sealed record PublicAddOnDto(string Code, string Name, string FeatureKey, bool IsPack, int PerUnit, long? MonthlyPriceMinor, long? YearlyPriceMinor);
public sealed record PublicCatalogDto(
    string ProductName,
    IReadOnlyList<PublicPlanDto> Plans,
    IReadOnlyList<PublicAddOnDto> AddOns,
    int TrialDays,
    int TrialLicences,
    int GraceDays,
    bool ChargesGst,
    decimal? GstRatePercent,
    bool TestPayments,
    string SellerName,
    string SellerPhone,
    string SellerEmail);

/// <summary>
/// The plans, licence prices and add-ons on sale now: for the public sign-up website and for the Owner's own
/// subscription page in the apps.
/// </summary>
public sealed class CatalogReader(
    PlatformDbContext catalog,
    CompanyDatabaseProvisioner provisioner,
    PlatformSettingsService platformSettings,
    SignupService signups,
    IOptions<PlatformOptions> options,
    ProductSelection products)
{
    private PlatformOptions Settings => options.Value;

    public async Task<PublicCatalogDto> ReadAsync(CancellationToken cancellationToken = default, string? productKey = null)
    {
        await provisioner.EnsureCatalogAsync(cancellationToken);
        var product = await products.RequiredAsync(productKey, cancellationToken);
        var now = DateTime.UtcNow;
        var plans = await catalog.Plans.AsNoTracking().Include(p => p.Versions).ThenInclude(v => v.Entitlements)
            .Where(p => p.ProductId == product.Id && p.IsActive).OrderBy(p => p.SortOrder).ToListAsync(cancellationToken);
        var addOns = await catalog.AddOns.AsNoTracking().Include(a => a.Prices)
            .Where(a => a.ProductId == product.Id && a.IsActive).OrderBy(a => a.Code).ToListAsync(cancellationToken);
        var effective = await platformSettings.GetAsync(cancellationToken, product.Key);

        static PublicPricesDto? Prices(PlanVersion? v) =>
            v is null ? null : new PublicPricesDto(v.PriceMinor, v.UserPriceMinor(AppAccess.Android), v.UserPriceMinor(AppAccess.Windows), v.UserPriceMinor(AppAccess.Both));
        long? AddOnPrice(AddOn a, BillingInterval interval) =>
            a.Prices.Where(p => p.Interval == interval && p.EffectiveFrom <= now && (p.EffectiveTo == null || p.EffectiveTo > now))
                .OrderByDescending(p => p.Version).Select(p => (long?)p.UnitPriceMinor).FirstOrDefault();

        return new PublicCatalogDto(
            product.Name,
            plans.Select(p =>
            {
                var month = PriceQuoteService.CurrentVersion(p, BillingInterval.Month, now);
                var year = PriceQuoteService.CurrentVersion(p, BillingInterval.Year, now);
                var reference = month ?? year;
                return new PublicPlanDto(p.Code, p.Name, reference?.IncludedSeats ?? 1,
                    reference?.Entitlements.Where(e => e.Value == "true").Select(e => e.FeatureKey).OrderBy(k => k).ToList() ?? [],
                    Prices(month), Prices(year));
            }).Where(p => p.Monthly is not null || p.Yearly is not null).ToList(),
            addOns.Select(a => new PublicAddOnDto(a.Code, a.Name, a.FeatureKey, a.Value != "true", int.TryParse(a.Value, out var unit) ? unit : 1,
                AddOnPrice(a, BillingInterval.Month), AddOnPrice(a, BillingInterval.Year))).ToList(),
            effective.TrialDays,
            effective.TrialLicences,
            effective.GraceDays,
            Settings.ChargesGst,
            Settings.ChargesGst ? Settings.GstRatePercent : null,
            signups.TestPaymentsAllowed,
            Settings.SellerName,
            Settings.SellerPhone,
            Settings.SellerEmail);
    }
}
