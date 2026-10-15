using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>The subscription rules that need no database: entitlements, access, invoice totals, codes, banners.</summary>
public class SubscriptionRulesTests
{
    private static readonly DateTime Now = new(2026, 10, 12, 6, 0, 0, DateTimeKind.Utc);

    private static Subscription SubscriptionOn(string planCode, int seats, SubscriptionStatus status, params (string Key, string Value)[] planFeatures)
    {
        var version = new PlanVersion
        {
            Id = Guid.NewGuid(), Interval = BillingInterval.Month, IncludedSeats = seats, PriceMinor = 199_900,
            Plan = new Plan { Code = planCode, Name = planCode }
        };
        foreach (var (key, value) in planFeatures)
            version.Entitlements.Add(new PlanEntitlement { FeatureKey = key, Value = value });
        foreach (var code in new[] { "android", "windows", "both" })
            version.SeatPrices.Add(new PlanVersionSeatPrice { SeatType = new ProductSeatType { Id = Guid.NewGuid(), Code = code } });
        return new Subscription { Status = status, PlanVersion = version, CurrentPeriodEnd = Now.AddDays(10) };
    }

    private static SubscriptionItem Item(string featureKey, string value, int quantity, DateTime? endedAt = null) => new()
    {
        Quantity = quantity,
        EffectiveFrom = Now.AddDays(-1),
        EffectiveTo = endedAt,
        AddOnPrice = new AddOnPrice { AddOn = new AddOn { Code = featureKey, FeatureKey = featureKey, Value = value } }
    };

    [Fact]
    public void Seats_AreThePlansUsers_PlusFivePerPack_AndEndedPacksDoNotCount()
    {
        var subscription = SubscriptionOn("professional", 10, SubscriptionStatus.Active);
        subscription.Items.Add(Item(FeatureKeys.UsersMaxActive, "5", 2));
        subscription.Items.Add(Item(FeatureKeys.UsersMaxActive, "5", 1, endedAt: Now.AddHours(-1)));

        var entitlements = PlatformEntitlementService.Build(subscription, Now);

        Assert.Equal(20, entitlements.SeatLimit);
        Assert.Equal("20", entitlements.Features[FeatureKeys.UsersMaxActive]);
    }

    [Fact]
    public void PerAppLicences_ReplaceTheOldUserLimit_AndAreReportedPerType()
    {
        var subscription = SubscriptionOn("starter", 1, SubscriptionStatus.Active);
        foreach (var price in subscription.PlanVersion!.SeatPrices)
            subscription.Seats.Add(new SubscriptionSeat { SeatTypeId = price.SeatType!.Id, SeatType = price.SeatType,
                Quantity = price.SeatType.Code == "android" ? 3 : price.SeatType.Code == "both" ? 2 : 0 });
        subscription.Items.Add(Item(FeatureKeys.UsersMaxActive, "5", 1)); // an old pack no longer adds anything

        var entitlements = PlatformEntitlementService.Build(subscription, Now);

        Assert.Equal(5, entitlements.SeatLimit);
        Assert.Equal(3, entitlements.LicencesFor(Domain.Enums.AppAccess.Android));
        Assert.Equal(0, entitlements.LicencesFor(Domain.Enums.AppAccess.Windows));
        Assert.Equal("2", entitlements.Features[FeatureKeys.LicencesBoth]);
        Assert.Null(CompanyEntitlements.Unmanaged.LicencesFor(Domain.Enums.AppAccess.Android));
    }

    [Theory]
    [InlineData(1, 0, 0, 1, null)]
    [InlineData(0, 0, 0, 1, "At least 1 user licence is needed.")]
    [InlineData(1, 0, 0, 2, "At least 2 user licences are needed.")]
    [InlineData(-1, 0, 3, 1, "Android licences must be between 0 and 500.")]
    [InlineData(0, 501, 0, 1, "Windows licences must be between 0 and 500.")]
    public void LicenceNumbers_AreChecked(int android, int windows, int both, int minimum, string? problem)
    {
        Assert.Equal(problem, new LicenceCounts(android, windows, both).Problem(minimum));
    }

    [Theory]
    [InlineData(Domain.Enums.AppAccess.Both, "windows", true)]
    [InlineData(Domain.Enums.AppAccess.Both, null, true)]
    [InlineData(Domain.Enums.AppAccess.Android, "android", true)]
    [InlineData(Domain.Enums.AppAccess.Android, "Android ", true)]
    [InlineData(Domain.Enums.AppAccess.Android, "windows", false)]
    [InlineData(Domain.Enums.AppAccess.Windows, "android", false)]
    [InlineData(Domain.Enums.AppAccess.Windows, null, false)]
    [InlineData(Domain.Enums.AppAccess.Windows, "ios", false)]
    public void AnAppIsAllowed_OnlyWhenTheUsersLicenceCoversIt(Domain.Enums.AppAccess access, string? app, bool allowed)
    {
        Assert.Equal(allowed, Domain.Enums.ClientApp.Allows(access, app));
    }

    [Fact]
    public void AnInvoice_HasOneLinePerLicenceType_AtThePlanVersionsPrices()
    {
        var version = new PlanVersion
        {
            Interval = BillingInterval.Month, Currency = "INR", PriceMinor = 0, Plan = new Plan { Name = "Starter" },
            SeatPrices =
            [
                new() { SeatType = new ProductSeatType { Code = "android" }, PriceMinor = 49_900 },
                new() { SeatType = new ProductSeatType { Code = "windows" }, PriceMinor = 69_900 },
                new() { SeatType = new ProductSeatType { Code = "both" }, PriceMinor = 99_900 }
            ]
        };
        Assert.Equal(69_900, version.UserPriceMinor(Domain.Enums.AppAccess.Windows));
        Assert.Equal(99_900, version.UserPriceMinor(Domain.Enums.AppAccess.Both));
    }

    [Fact]
    public void AnAddOnSwitchesItsModuleOn_AndThePlansOwnFeaturesStay()
    {
        var subscription = SubscriptionOn("starter", 3, SubscriptionStatus.Active,
            (FeatureKeys.Showroom, "false"), (FeatureKeys.WhatsAppAutomation, "false"));
        subscription.Items.Add(Item(FeatureKeys.Showroom, "true", 1));

        var entitlements = PlatformEntitlementService.Build(subscription, Now);

        Assert.True(entitlements.Has(FeatureKeys.Showroom));
        Assert.False(entitlements.Has(FeatureKeys.WhatsAppAutomation));
        Assert.False(entitlements.Has(FeatureKeys.FranchiseNetwork));
        Assert.Equal("0", entitlements.Features[FeatureKeys.FranchiseNetworkBranches]);
    }

    [Fact]
    public void TheFranchiseNetwork_IncludesTenBranches_AndPacksOfTenAddMore()
    {
        var subscription = SubscriptionOn("professional", 10, SubscriptionStatus.Active);
        subscription.Items.Add(Item(FeatureKeys.FranchiseNetwork, "true", 1));
        subscription.Items.Add(Item(FeatureKeys.FranchiseNetworkBranches, "10", 2));

        var entitlements = PlatformEntitlementService.Build(subscription, Now);

        Assert.True(entitlements.Has(FeatureKeys.FranchiseNetwork));
        Assert.Equal(30, entitlements.Number(FeatureKeys.FranchiseNetworkBranches));
    }

    [Theory]
    [InlineData(SubscriptionStatus.Trialing, CompanyAccessLevel.Full)]
    [InlineData(SubscriptionStatus.Active, CompanyAccessLevel.Full)]
    [InlineData(SubscriptionStatus.PastDue, CompanyAccessLevel.Full)]
    [InlineData(SubscriptionStatus.ReadOnly, CompanyAccessLevel.ReadOnly)]
    [InlineData(SubscriptionStatus.Suspended, CompanyAccessLevel.None)]
    [InlineData(SubscriptionStatus.Incomplete, CompanyAccessLevel.None)]
    public void EachState_GivesTheAgreedAccess(SubscriptionStatus status, CompanyAccessLevel expected)
    {
        Assert.Equal(expected, PlatformEntitlementService.AccessFor(new Subscription { Status = status }, Now));
    }

    [Fact]
    public void ACanceledCompany_IsReadOnlyUntilTheRetentionEnds_ThenHasNoAccess()
    {
        var canceled = new Subscription { Status = SubscriptionStatus.Canceled, RetainUntil = Now.AddDays(1) };
        Assert.Equal(CompanyAccessLevel.ReadOnly, PlatformEntitlementService.AccessFor(canceled, Now));

        canceled.RetainUntil = Now.AddDays(-1);
        Assert.Equal(CompanyAccessLevel.None, PlatformEntitlementService.AccessFor(canceled, Now));
    }

    [Fact]
    public void OnASingleCompanyServer_EverythingIsAllowed()
    {
        var unmanaged = CompanyEntitlements.Unmanaged;
        Assert.True(unmanaged.Has(FeatureKeys.Showroom));
        Assert.Null(unmanaged.SeatLimit);
        Assert.Equal(CompanyAccessLevel.Full, unmanaged.Access);
        Assert.Null(SubscriptionController.BannerFor(unmanaged, Now));
    }

    [Theory]
    [InlineData("showroom.view", FeatureKeys.Showroom)]
    [InlineData("reports.showrooms", FeatureKeys.Showroom)]
    [InlineData("staff_advances.create", FeatureKeys.StaffAdvances)]
    [InlineData("staff_salary.view", FeatureKeys.StaffAdvances)]
    [InlineData("outsidejobs.manage", FeatureKeys.OutsideJobs)]
    [InlineData("vendors.view", FeatureKeys.OutsideJobs)]
    [InlineData("audit.view", FeatureKeys.AuditTrail)]
    [InlineData("reports.gst", FeatureKeys.AdvancedReports)]
    [InlineData("staff.view", null)]
    [InlineData("invoices.view", null)]
    [InlineData("reports.invoices", null)]
    [InlineData("settings.view", null)]
    public void EachPermission_BelongsToTheSamePlanFeatureAsInTheApps(string permission, string? feature)
    {
        // Mirrors featureForPermission in the Windows app and PlanFeatures.featureForPermission in Android.
        Assert.Equal(feature, PlanFeatureMap.ForPermission(permission));
    }

    [Fact]
    public void WithoutAGstin_AnInvoiceCarriesNoTax()
    {
        var invoice = InvoiceWith(199_900, 99_900);
        BillingInvoiceService.ApplyTotals(invoice, new PlatformOptions());

        Assert.Equal(299_800, invoice.SubtotalMinor);
        Assert.Equal(0, invoice.TaxMinor);
        Assert.Null(invoice.TaxRatePercent);
        Assert.Equal(299_800, invoice.TotalMinor);
        Assert.Equal(299_800, invoice.AmountDueMinor);
    }

    [Fact]
    public void OnceTrovoHasAGstin_NewInvoicesAddGstRoundedToThePaisa()
    {
        var invoice = InvoiceWith(199_900);
        BillingInvoiceService.ApplyTotals(invoice, new PlatformOptions { Gstin = "33ABCDE1234F1Z5", GstRatePercent = 18m });

        Assert.Equal(35_982, invoice.TaxMinor); // 18% of ₹1,999.00 = ₹359.82
        Assert.Equal(18m, invoice.TaxRatePercent);
        Assert.Equal(235_882, invoice.TotalMinor);
    }

    [Theory]
    [InlineData(2026, 3, 31, 18, 0, "2025-26")] // 31 Mar 23:30 IST
    [InlineData(2026, 3, 31, 19, 0, "2026-27")] // 1 Apr 00:30 IST
    [InlineData(2026, 10, 12, 6, 0, "2026-27")]
    [InlineData(2027, 1, 15, 6, 0, "2026-27")]
    public void InvoiceNumbers_FollowTheIndianFinancialYear(int year, int month, int day, int hour, int minute, string expected)
    {
        Assert.Equal(expected, BillingInvoiceService.FinancialYear(new DateTime(year, month, day, hour, minute, 0, DateTimeKind.Utc)));
    }

    [Fact]
    public void AuthenticatorCodes_MatchTheRfc6238Reference_AndAllowOneStepOfDrift()
    {
        // RFC 6238 test secret "12345678901234567890" (SHA-1); at T=59 s the 8-digit code is 94287082.
        const string secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
        var at = DateTimeOffset.FromUnixTimeSeconds(59).UtcDateTime;

        Assert.Equal("287082", Totp.CodeAt(secret, at));
        Assert.True(Totp.Verify(secret, "287 082", at));
        Assert.True(Totp.Verify(secret, Totp.CodeAt(secret, at.AddSeconds(-30)), at));
        Assert.False(Totp.Verify(secret, Totp.CodeAt(secret, at.AddSeconds(-90)), at));
        Assert.False(Totp.Verify(secret, "000000", at));
        Assert.False(Totp.Verify(secret, "12345", at));
    }

    [Fact]
    public void TheBanner_WarnsAboutTheTrialEnd_OverduePayment_AndReadOnly()
    {
        CompanyEntitlements With(SubscriptionStatus status, DateTime? trialEnds = null) => new(
            true, PlatformEntitlementService.AccessFor(new Subscription { Status = status }, Now), status, "professional", "Professional",
            BillingInterval.Month, new Dictionary<string, string>(), 10, trialEnds, Now.AddDays(5), Now.AddDays(10), null);

        Assert.Null(SubscriptionController.BannerFor(With(SubscriptionStatus.Trialing, Now.AddDays(6)), Now));
        Assert.Equal("info", SubscriptionController.BannerFor(With(SubscriptionStatus.Trialing, Now.AddDays(2)), Now)!.Level);
        Assert.Equal("warning", SubscriptionController.BannerFor(With(SubscriptionStatus.PastDue), Now)!.Level);
        Assert.Equal("error", SubscriptionController.BannerFor(With(SubscriptionStatus.ReadOnly), Now)!.Level);
        Assert.Null(SubscriptionController.BannerFor(With(SubscriptionStatus.Active), Now));
    }

    private static BillingInvoice InvoiceWith(params long[] amounts)
    {
        var invoice = new BillingInvoice();
        foreach (var amount in amounts) invoice.Lines.Add(new BillingInvoiceLine { Quantity = 1, UnitPriceMinor = amount, AmountMinor = amount });
        return invoice;
    }
}
