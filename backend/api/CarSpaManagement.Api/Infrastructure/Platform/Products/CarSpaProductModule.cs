using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CarSpaManagement.Api.Infrastructure.Platform.Products;

public sealed class CarSpaProductModule(IConfiguration configuration, IOptions<PlatformOptions> options) : IProductModule
{
    public string Key => options.Value.ProductKey;
    public string Name => options.Value.ProductName;
    public string DatabasePrefix => Key;
    public string TrialPlanCode => "professional";
    public SeatModel SeatModel => SeatModel.PerType;
    public static IReadOnlyList<SeatTypeDefinition> SeatDefinitions { get; } =
        [new("android", "Android only", 1), new("windows", "Windows only", 2), new("both", "Windows + Android", 3)];
    public static IReadOnlyList<FeatureDefinition> FeatureDefinitions { get; } = FeatureKeys.All
        .Concat(new Dictionary<string, EntitlementValueType>
        {
            [FeatureKeys.LicencesAndroid] = EntitlementValueType.Int,
            [FeatureKeys.LicencesWindows] = EntitlementValueType.Int,
            [FeatureKeys.LicencesBoth] = EntitlementValueType.Int
        }).Select((entry, index) => new FeatureDefinition(entry.Key, entry.Value, CarSpaCatalogSeed.FeatureLabels[entry.Key], index + 1)).ToArray();
    public IReadOnlyList<SeatTypeDefinition> SeatTypes => SeatDefinitions;
    public IReadOnlyList<FeatureDefinition> Features => FeatureDefinitions;
    public IReadOnlySet<string> Capabilities { get; } = new HashSet<string> { "franchise" };

    public Task SeedCatalogAsync(PlatformDbContext catalog, PlatformProduct product, CancellationToken cancellationToken) =>
        CarSpaCatalogSeed.SeedAsync(catalog, product, cancellationToken);

    public async Task<string?> MigrateCompanyDatabaseAsync(ProvisionContext context, CancellationToken cancellationToken)
    {
        var dbOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(context.AdminConnection(context.DatabaseName), n => n.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName))
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .AddInterceptors(new TenantSessionInterceptor()).Options;
        await using var db = new AppDbContext(dbOptions, new FixedTenantContext(context.CompanyId));
        await db.Database.MigrateAsync(cancellationToken);
        await PermissionSeeder.SeedAsync(db);
        if (!await db.Organizations.AnyAsync(o => o.Id == context.CompanyId, cancellationToken))
        {
            db.Organizations.Add(new Organization
            {
                Id = context.CompanyId, Code = context.Code, Name = context.Name, IsActive = true, CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync(cancellationToken);
        }
        await new OrganizationProvisioner(db, configuration).SeedDefaultsAsync(includeDevelopmentDemoData: false, cancellationToken);
        return (await db.Database.GetAppliedMigrationsAsync(cancellationToken)).LastOrDefault();
    }
}
