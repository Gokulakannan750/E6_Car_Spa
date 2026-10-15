using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class GenericSeatRulesTests
{
    [Theory]
    [InlineData(SeatModel.PerType, 0)]
    [InlineData(SeatModel.Counted, 0)]
    [InlineData(SeatModel.None, null)]
    public void StoredRowsPreventLegacyFallback_EvenWhenQuantityIsZero(SeatModel model, int? expected)
    {
        var product = new PlatformProduct { SeatModel = model };
        var version = new PlanVersion { IncludedSeats = 10 };
        version.Entitlements.Add(new PlanEntitlement { FeatureKey = FeatureKeys.UsersMaxActive, Value = "10" });
        var subscription = new Subscription { PlanVersion = version, Status = SubscriptionStatus.Active };
        subscription.Seats.Add(new SubscriptionSeat { SeatType = new ProductSeatType { Code = "user" }, Quantity = 0 });
        subscription.Items.Add(new SubscriptionItem { EffectiveFrom = DateTime.UtcNow.AddDays(-1), Quantity = 2,
            AddOnPrice = new AddOnPrice { AddOn = new AddOn { FeatureKey = FeatureKeys.UsersMaxActive, Value = "5" } } });
        var definitions = new[] { new ProductFeature { Key = FeatureKeys.UsersMaxActive, ValueType = EntitlementValueType.Int } };
        var result = PlatformEntitlementService.Build(subscription, DateTime.UtcNow, product, definitions);
        Assert.Equal(expected, result.SeatLimit);
        Assert.Equal(0, result.Seats!["user"]);
    }

    [Theory]
    [InlineData(SeatModel.None, null)]
    [InlineData(SeatModel.Counted, 0)]
    public void NonPerTypeProductsNeverUseLegacyFallback_WithoutRows(SeatModel model, int? expected)
    {
        var subscription = new Subscription { PlanVersion = new PlanVersion { IncludedSeats = 10 } };
        Assert.Equal(expected, PlatformEntitlementService.Build(subscription, DateTime.UtcNow,
            new PlatformProduct { SeatModel = model }, []).SeatLimit);
    }

    [Fact]
    public void FeaturesAreProductScoped_AndFranchiseExpansionRequiresCapability()
    {
        var version = new PlanVersion();
        foreach (var key in new[] { "civil.projects", "other.secret", FeatureKeys.FranchiseNetwork, FeatureKeys.FranchiseNetworkBranches })
            version.Entitlements.Add(new PlanEntitlement { FeatureKey = key, Value = key == FeatureKeys.FranchiseNetworkBranches ? "7" : "true" });
        var definitions = new[]
        {
            new ProductFeature { Key = "civil.projects", ValueType = EntitlementValueType.Bool },
            new ProductFeature { Key = FeatureKeys.FranchiseNetwork, ValueType = EntitlementValueType.Bool },
            new ProductFeature { Key = FeatureKeys.FranchiseNetworkBranches, ValueType = EntitlementValueType.Int }
        };
        var result = PlatformEntitlementService.Build(new Subscription { PlanVersion = version }, DateTime.UtcNow,
            new PlatformProduct { SeatModel = SeatModel.None }, definitions);
        Assert.True(result.Has("civil.projects"));
        Assert.False(result.Has("other.secret"));
        Assert.Equal(7, result.Number(FeatureKeys.FranchiseNetworkBranches)); // no Car Spa +10 calculation
        Assert.Null(result.SeatLimit);
    }

    [Fact]
    public void PlanFactoryUsesProductDefinitionsAndGenericPrices()
    {
        var product = new PlatformProduct { Id = Guid.NewGuid(), SeatModel = SeatModel.Counted };
        var seat = new ProductSeatType { Id = Guid.NewGuid(), ProductId = product.Id, Code = "user", Name = "User" };
        var features = new[] { new ProductFeature { ProductId = product.Id, Key = "civil.projects", ValueType = EntitlementValueType.Bool } };
        var terms = new PlanTerms(1000, 1, 0, 0, 0, new Dictionary<string, string> { ["civil.projects"] = "true" },
            new Dictionary<string, long> { ["user"] = 250 });
        var version = PlanVersionFactory.Create(new Plan { Id = Guid.NewGuid(), ProductId = product.Id }, BillingInterval.Month,
            terms, DateTime.UtcNow, [seat], product, features);
        Assert.Equal(250, Assert.Single(version.SeatPrices).PriceMinor);
        Assert.Equal("civil.projects", Assert.Single(version.Entitlements).FeatureKey);
        Assert.Throws<ValidationException>(() => PlanVersionFactory.Validate(terms with
            { Features = new Dictionary<string, string> { [FeatureKeys.Showroom] = "true" } }, product, features));
    }
}
