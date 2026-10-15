using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform.Products;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>Compatibility entry point for existing Car Spa catalog callers.</summary>
public static class PlatformCatalogSeeder
{
    public static IReadOnlyDictionary<string, string> FeatureLabels => CarSpaCatalogSeed.FeatureLabels;
    public static Task SeedAsync(PlatformDbContext catalog, PlatformProduct product, CancellationToken cancellationToken = default) =>
        CarSpaCatalogSeed.SeedAsync(catalog, product, cancellationToken);
}
