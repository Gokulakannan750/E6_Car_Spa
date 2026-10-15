using System.Collections.Concurrent;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Infrastructure.Platform.Products;
using CarSpaManagement.Api.Infrastructure.Security;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Npgsql;
using Serilog;
using Serilog.Core;
using Serilog.Events;
using Xunit;

namespace CarSpaManagement.Api.Tests;

// Capturing the existing static Serilog logger must not race other API-host tests.
[CollectionDefinition("Product module logging", DisableParallelization = true)]
public sealed class ProductModuleLoggingCollection { }

[Collection("Product module logging")]
public class ProductModuleTests
{
    [Theory]
    [InlineData(null, "psql", true, "PowerShell")]
    [InlineData("pwsh", null, true, "psql")]
    public void ExternalScript_MissingToolHasClearSkipReason(string? shell, string? psql, bool needsPsql, string expected)
    {
        Assert.Contains(expected, ExternalProductTestScript.ToolSkipReason(shell, psql, needsPsql));
        Assert.Null(ExternalProductTestScript.ToolSkipReason("pwsh", "psql", needsPsql));
    }

    [Fact]
    public void ApiFixture_HasExactlyOnePublicConstructor()
    {
        Assert.Empty(Assert.Single(typeof(PlatformApiHost).GetConstructors()).GetParameters());
    }

    private static ProvisionContext Context() => new(Guid.NewGuid(), "0001", "Demo company", "demo_t_0001",
        _ => "Host=localhost;Username=test;Password=external-test-secret;Database=demo_t_0001");

    private static ExternalCommandProductModule Module(string mode, double timeout = 300) => new("demo", new ExternalProductOptions
    {
        Name = "Demo", DatabasePrefix = "demo", TrialPlanCode = "demo_trial",
        MigrateCommand = ExternalProductTestScript.Command, MigrateArguments = ExternalProductTestScript.Arguments(mode),
        MigrateTimeoutSeconds = timeout
    });

    [ExternalProductFact]
    public async Task ExternalCommand_UsesLastNonemptyLineAsSchemaVersion()
    {
        Assert.Equal("demo-v1", await Module("success").MigrateCompanyDatabaseAsync(Context(), default));
        Assert.Equal(300, new ExternalProductOptions().MigrateTimeoutSeconds);
    }

    [ExternalProductFact]
    public async Task ExternalCommand_NonzeroExitReturnsFirst1000StderrCharacters()
    {
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => Module("fail").MigrateCompanyDatabaseAsync(Context(), default));
        Assert.Equal("failure-" + new string('x', 992), error.Message);
    }

    [ExternalProductFact]
    public async Task ExternalCommand_TimesOutAndTerminatesChild()
    {
        var started = System.Diagnostics.Stopwatch.StartNew();
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => Module("timeout", 0.2).MigrateCompanyDatabaseAsync(Context(), default));
        Assert.Contains("timed out", error.Message);
        Assert.True(started.Elapsed < TimeSpan.FromSeconds(15));
    }

    [ExternalProductFact]
    public async Task ExternalCommand_RedactsSecretsBeforeTruncatingError()
    {
        var sink = new CapturedLogs();
        var previous = Log.Logger;
        using var logger = new LoggerConfiguration().WriteTo.Sink(sink).CreateLogger();
        Log.Logger = logger;
        try
        {
            var error = await Assert.ThrowsAsync<InvalidOperationException>(() => Module("secret").MigrateCompanyDatabaseAsync(Context(), default));
            Assert.StartsWith("[REDACTED]", error.Message);
            Assert.Equal(1000, error.Message.Length);
            Assert.DoesNotContain("external-test-secret", error.ToString());
            Assert.DoesNotContain("postgresql://", error.ToString());
            Assert.DoesNotContain("external-test-secret", sink.Text);
            Assert.DoesNotContain("Password=", sink.Text);
        }
        finally { Log.Logger = previous; }
    }

    [Fact]
    public void Registry_UsesRuntimeKey_RequiresExplicitSelectionForMultipleProducts_RejectsUnknownAndCollidingPrefixes()
    {
        var config = new Dictionary<string, string?>();
        ExternalProductTestScript.Configure(config, "runtime");
        var registry = new ProductModuleRegistry(new ConfigurationBuilder().AddInMemoryCollection(config).Build(),
            Options.Create(new PlatformOptions { ProductKey = "runtime", ProductName = "Car Spa" }));
        Assert.IsType<CarSpaProductModule>(registry.Get("runtime"));
        Assert.IsType<ExternalCommandProductModule>(registry.Get("demo"));
        Assert.False(registry.TryGet("missing", out _));
        Assert.Throws<ValidationException>(() => registry.Get("missing"));
        using var catalog = new PlatformDbContext(new DbContextOptionsBuilder<PlatformDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var selection = new ProductSelection(registry, catalog);
        Assert.Throws<ValidationException>(() => selection.RequiredKey(null));
        Assert.Equal("demo", selection.RequiredKey("demo"));
        Assert.Null(selection.OptionalKey(null));
        config["Platform:ExternalProducts:demo:DatabasePrefix"] = "runtime";
        Assert.Throws<InvalidOperationException>(() => new ProductModuleRegistry(new ConfigurationBuilder().AddInMemoryCollection(config).Build(),
            Options.Create(new PlatformOptions { ProductKey = "runtime", ProductName = "Car Spa" })));
    }

    [PostgresFact]
    public async Task RepeatedCatalogInitialization_PreservesAdminMetadataDefinitionsAndPrices()
    {
        await using var env = new PlatformTestEnvironment(configureSettings: ExternalProductTestScript.Configure);
        await using (var scope = env.Scope())
        {
            var catalog = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            await scope.ServiceProvider.GetRequiredService<CompanyDatabaseProvisioner>().EnsureCatalogAsync();
            foreach (var product in await catalog.Products.ToListAsync())
            {
                product.Name = "Edited " + product.Key;
                product.SeatModel = SeatModel.None;
                product.TrialPlanCode = "edited_trial";
                product.Capabilities = "edited_capability";
                product.DatabasePrefix += "_edited";
            }
            var seat = await catalog.ProductSeatTypes.FirstAsync();
            seat.Name = "Edited seat";
            seat.IsActive = false;
            var feature = await catalog.ProductFeatures.FirstAsync();
            feature.Label = "Edited feature";
            var price = await catalog.PlanVersionSeatPrices.FirstAsync();
            price.PriceMinor = 54321;
            var demoPlan = await catalog.Plans.SingleAsync(p => p.Product!.Key == "demo");
            demoPlan.Name = "Edited demo plan";
            await catalog.SaveChangesAsync();
        }
        await using (var scope = env.Scope())
        {
            var catalog = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            await scope.ServiceProvider.GetRequiredService<CompanyDatabaseProvisioner>().EnsureCatalogAsync();
            Assert.All(await catalog.Products.ToListAsync(), p =>
            {
                Assert.Equal("Edited " + p.Key, p.Name);
                Assert.Equal(SeatModel.None, p.SeatModel);
                Assert.Equal("edited_trial", p.TrialPlanCode);
                Assert.Equal("edited_capability", p.Capabilities);
                Assert.EndsWith("_edited", p.DatabasePrefix);
            });
            Assert.Equal(1, await catalog.ProductSeatTypes.CountAsync(s => s.Name == "Edited seat" && !s.IsActive));
            Assert.Equal(1, await catalog.ProductFeatures.CountAsync(f => f.Label == "Edited feature"));
            Assert.Equal(1, await catalog.PlanVersionSeatPrices.CountAsync(p => p.PriceMinor == 54321));
            Assert.Equal("Edited demo plan", (await catalog.Plans.SingleAsync(p => p.Product!.Key == "demo")).Name);
        }
    }

    [PostgresFact]
    public async Task AssignedSeatId_NewChildOfTrackedPlanVersion_IsInserted()
    {
        await using var env = new PlatformTestEnvironment();
        await using var scope = env.Scope();
        var catalog = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var product = await scope.ServiceProvider.GetRequiredService<CompanyDatabaseProvisioner>().EnsureCatalogAsync();
        var parent = await catalog.PlanVersions.FirstAsync();
        var type = new ProductSeatType { Id = Guid.NewGuid(), ProductId = product.Id, Code = "extra", Name = "Extra seat" };
        catalog.ProductSeatTypes.Add(type);
        await catalog.SaveChangesAsync();
        var child = new PlanVersionSeatPrice { Id = Guid.NewGuid(), PlanVersionId = parent.Id, SeatTypeId = type.Id, SeatType = type, PriceMinor = 789 };
        parent.SeatPrices.Add(child);
        catalog.ChangeTracker.DetectChanges();
        Assert.Equal(EntityState.Added, catalog.Entry(child).State);
        foreach (var entity in new[] { typeof(ProductSeatType), typeof(ProductFeature), typeof(PlanVersionSeatPrice), typeof(SubscriptionSeat), typeof(SignupOrderSeat) })
            Assert.Equal(ValueGenerated.Never, catalog.Model.FindEntityType(entity)!.FindProperty("Id")!.ValueGenerated);
        await catalog.SaveChangesAsync();
        catalog.ChangeTracker.Clear();
        Assert.Equal(789, (await catalog.PlanVersionSeatPrices.SingleAsync(s => s.Id == child.Id)).PriceMinor);
    }

    [ExternalProductTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task SameCode_SignInAndTokenLookupAreScopedToProduct_InBothDirections(bool demoRuntime)
    {
        await using var env = new PlatformTestEnvironment(configureSettings: ExternalProductTestScript.Configure);
        var spa = await env.CreateCompanyAsync("Car Spa company");
        await using var scope = env.Scope();
        var sp = scope.ServiceProvider;
        var catalog = sp.GetRequiredService<PlatformDbContext>();
        var demo = await sp.GetRequiredService<CompanyDatabaseProvisioner>().CreateCompanyAsync("demo", "Demo company");
        Assert.Equal("0001", spa.Company.Code);
        Assert.Equal("0001", demo.Company.Code);
        foreach (var company in await catalog.Companies.ToListAsync()) company.Status = PlatformCompanyStatus.Active;
        await catalog.SaveChangesAsync();
        var runtimeKey = demoRuntime ? "demo" : env.ProductKey;
        var mine = demoRuntime ? demo.Company : spa.Company;
        var other = demoRuntime ? spa.Company : demo.Company;
        // Share a cache and populate the other runtime first: cached token routes must also be product scoped.
        var cache = sp.GetRequiredService<IMemoryCache>();
        PlatformCompanyDirectory DirectoryFor(string key) => new(catalog, sp.GetRequiredService<IAesEncryptionService>(),
            sp.GetRequiredService<IConfiguration>(), cache, Options.Create(new PlatformOptions { ProductKey = key }));
        var otherDirectory = DirectoryFor(demoRuntime ? env.ProductKey : "demo");
        Assert.NotNull(await otherDirectory.FindActiveByIdAsync(other.Id));
        var directory = DirectoryFor(runtimeKey);
        Assert.Equal(mine.Id, (await directory.FindActiveByCodeAsync("0001"))!.Id);
        Assert.Equal(mine.Id, (await directory.FindActiveByCodeAsync(null))!.Id);
        Assert.Null(await directory.FindActiveByIdAsync(other.Id));
        Assert.Equal(mine.Id, Assert.Single(await directory.ListActiveAsync()).Id);
        catalog.ChangeTracker.Clear();
        var spaAfter = await catalog.Companies.SingleAsync(c => c.Id == spa.Company.Id);
        Assert.Equal("0001", spaAfter.Code);
        Assert.Equal(spa.Company.DatabaseName, spaAfter.DatabaseName);
        Assert.Equal(env.ProductKey + "_t_0001", spaAfter.DatabaseName);
        Assert.Equal(env.ProductKey + "_demo_t_0001", demo.Company.DatabaseName);
        Assert.Equal("demo-v1", demo.Company.SchemaVersion);
        await using var connection = new NpgsqlConnection(PlatformTestEnvironment.AdminConnection(demo.Company.DatabaseName));
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT id FROM company", connection);
        Assert.Equal(demo.Company.Id, (Guid)(await command.ExecuteScalarAsync())!);
        var subscription = await catalog.Subscriptions.Include(s => s.PlanVersion!).ThenInclude(v => v.Plan).SingleAsync(s => s.CompanyId == demo.Company.Id);
        Assert.Equal("demo_trial", subscription.PlanVersion!.Plan!.Code);
        Assert.Empty(subscription.Seats);
        var next = await sp.GetRequiredService<CompanyDatabaseProvisioner>().CreateCompanyAsync("Next Car Spa");
        Assert.Equal("0002", next.Company.Code);
        Assert.Equal(env.ProductKey + "_t_0002", next.Company.DatabaseName);
    }

    [ExternalProductTheory]
    [InlineData("fail")]
    [InlineData("secret")]
    [InlineData("timeout")]
    public async Task ExternalMigrationFailures_AreRecordedPauseSignInAndNeverLeakSecrets(string mode)
    {
        await using var env = new PlatformTestEnvironment(configureSettings: (settings, prefix) =>
        {
            ExternalProductTestScript.Configure(settings, prefix);
            settings["Platform:ExternalProducts:demo:MigrateTimeoutSeconds"] = "5";
        });
        await using var scope = env.Scope();
        var sp = scope.ServiceProvider;
        var provisioner = sp.GetRequiredService<CompanyDatabaseProvisioner>();
        var created = await provisioner.CreateCompanyAsync("demo", "Demo company");
        var catalog = sp.GetRequiredService<PlatformDbContext>();
        created.Company.Status = PlatformCompanyStatus.Active;
        created.Company.Name = mode;
        await catalog.SaveChangesAsync();
        var sink = new CapturedLogs();
        var previous = Log.Logger;
        using var logger = new LoggerConfiguration().WriteTo.Sink(sink).CreateLogger();
        Log.Logger = logger;
        try { await provisioner.MigrateCompanyAsync(created.Company); }
        finally { Log.Logger = previous; }
        catalog.ChangeTracker.Clear();
        var stored = await catalog.Companies.SingleAsync(c => c.Id == created.Company.Id);
        Assert.NotNull(stored.MigrationError);
        if (mode == "fail") Assert.Equal("failure-" + new string('x', 992), stored.MigrationError);
        if (mode == "secret") Assert.StartsWith("[REDACTED]", stored.MigrationError);
        if (mode == "timeout") Assert.Contains("timed out", stored.MigrationError);
        var admin = sp.GetRequiredService<IConfiguration>().GetConnectionString("PlatformAdmin")!;
        var password = new NpgsqlConnectionStringBuilder(admin).Password!;
        Assert.DoesNotContain(admin, stored.MigrationError);
        Assert.DoesNotContain(password, stored.MigrationError);
        Assert.DoesNotContain(admin, sink.Text);
        Assert.DoesNotContain(password, sink.Text);
        Assert.DoesNotContain("postgresql://", sink.Text);
        var directory = new PlatformCompanyDirectory(catalog, sp.GetRequiredService<IAesEncryptionService>(),
            sp.GetRequiredService<IConfiguration>(), sp.GetRequiredService<IMemoryCache>(), Options.Create(new PlatformOptions { ProductKey = "demo" }));
        Assert.Null(await directory.FindActiveByCodeAsync("0001"));
        Assert.Null(await directory.FindActiveByIdAsync(stored.Id));
        // A later successful migration clears the failure and restores lookup, as before.
        stored.Name = "Demo company";
        await provisioner.MigrateCompanyAsync(stored);
        Assert.Null(stored.MigrationError);
        Assert.NotNull(await directory.FindActiveByCodeAsync("0001"));
    }

    private sealed class CapturedLogs : ILogEventSink
    {
        private readonly ConcurrentQueue<string> entries = new();
        public string Text => string.Join("\n", entries);
        public void Emit(LogEvent logEvent) => entries.Enqueue(logEvent.RenderMessage() + logEvent.Exception);
    }
}
