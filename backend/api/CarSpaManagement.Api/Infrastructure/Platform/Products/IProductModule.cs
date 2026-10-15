using CarSpaManagement.Api.Domain.Platform;

namespace CarSpaManagement.Api.Infrastructure.Platform.Products;

public sealed record SeatTypeDefinition(string Code, string Name, int SortOrder);
public sealed record FeatureDefinition(string Key, EntitlementValueType ValueType, string Label, int SortOrder);
public sealed record ProvisionContext(Guid CompanyId, string Code, string Name, string DatabaseName,
    Func<string, string> AdminConnection);

public interface IProductModule
{
    string Key { get; }
    string Name { get; }
    string DatabasePrefix { get; }
    string TrialPlanCode { get; }
    SeatModel SeatModel { get; }
    IReadOnlyList<SeatTypeDefinition> SeatTypes { get; }
    IReadOnlyList<FeatureDefinition> Features { get; }
    IReadOnlySet<string> Capabilities { get; }
    Task SeedCatalogAsync(PlatformDbContext catalog, PlatformProduct product, CancellationToken cancellationToken);
    Task<string?> MigrateCompanyDatabaseAsync(ProvisionContext context, CancellationToken cancellationToken);
}

public interface IProductModuleRegistry
{
    IProductModule Get(string key);
    bool TryGet(string key, out IProductModule module);
    IReadOnlyList<IProductModule> All { get; }
}
