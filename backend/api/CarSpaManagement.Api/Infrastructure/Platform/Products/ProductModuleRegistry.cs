using System.Text.RegularExpressions;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CarSpaManagement.Api.Infrastructure.Platform.Products;

public sealed class ProductModuleRegistry : IProductModuleRegistry
{
    private readonly Dictionary<string, IProductModule> modules;
    public ProductModuleRegistry(IConfiguration configuration, IOptions<PlatformOptions> options)
    {
        var all = new List<IProductModule> { new CarSpaProductModule(configuration, options) };
        foreach (var section in configuration.GetSection("Platform:ExternalProducts").GetChildren())
        {
            var external = section.Get<ExternalProductOptions>() ?? throw new InvalidOperationException("Invalid external product configuration.");
            if (string.IsNullOrWhiteSpace(external.MigrateCommand) || external.MigrateTimeoutSeconds is <= 0 or > 300)
                throw new InvalidOperationException($"Product {section.Key} requires a migration command and a timeout of at most 300 seconds.");
            if (external.SeedPlans.All(p => p.Code != external.TrialPlanCode))
                throw new InvalidOperationException($"Product {section.Key} requires its trial plan in SeedPlans.");
            if (!Enum.IsDefined(external.SeatModel) || (external.SeatModel == SeatModel.None && external.SeatTypes.Count != 0)
                || (external.SeatModel == SeatModel.Counted && external.SeatTypes.Count != 1))
                throw new InvalidOperationException($"Invalid seat model for product {section.Key}.");
            foreach (var plan in external.SeedPlans)
            {
                if (plan.MonthlyPriceMinor < 0 || plan.YearlyPriceMinor < 0 || plan.SeatPrices.Values.Any(p => p.MonthlyPriceMinor < 0 || p.YearlyPriceMinor < 0)
                    || plan.SeatPrices.Keys.Any(code => external.SeatTypes.All(s => s.Code != code))
                    || plan.Entitlements.Keys.Any(key => external.Features.All(f => f.Key != key)))
                    throw new InvalidOperationException($"Invalid seed plan for product {section.Key}.");
            }
            all.Add(new ExternalCommandProductModule(section.Key, external));
        }
        foreach (var module in all)
        {
            if (!Regex.IsMatch(module.Key, "^[a-z][a-z0-9_]{0,29}$") || !Regex.IsMatch(module.DatabasePrefix, "^[a-z][a-z0-9_]{0,29}$")
                || string.IsNullOrWhiteSpace(module.Name) || module.Name.Length > 100 || string.IsNullOrWhiteSpace(module.TrialPlanCode) || module.TrialPlanCode.Length > 50)
                throw new InvalidOperationException("Invalid product key, metadata or database prefix.");
            if (module.SeatTypes.Select(s => s.Code).Distinct().Count() != module.SeatTypes.Count
                || module.SeatTypes.Any(s => !Regex.IsMatch(s.Code, "^[a-z][a-z0-9_]{0,29}$") || string.IsNullOrWhiteSpace(s.Name) || s.Name.Length > 100)
                || module.Features.Select(f => f.Key).Distinct().Count() != module.Features.Count
                || module.Features.Any(f => string.IsNullOrWhiteSpace(f.Key) || f.Key.Length > 60 || string.IsNullOrWhiteSpace(f.Label) || f.Label.Length > 100 || !Enum.IsDefined(f.ValueType)))
                throw new InvalidOperationException($"Invalid seat or feature definitions for product {module.Key}.");
        }
        if (all.Select(m => m.Key).Distinct(StringComparer.Ordinal).Count() != all.Count
            || all.Select(m => m.DatabasePrefix).Distinct(StringComparer.Ordinal).Count() != all.Count)
            throw new InvalidOperationException("Product keys and database prefixes must be unique.");
        modules = all.ToDictionary(m => m.Key, StringComparer.Ordinal);
        All = all.AsReadOnly();
    }
    public IReadOnlyList<IProductModule> All { get; }
    public IProductModule Get(string key) => TryGet(key, out var module) ? module : throw new ValidationException($"Unknown product '{key}'.");
    public bool TryGet(string key, out IProductModule module) => modules.TryGetValue(key, out module!);
}

/// <summary>Product selection for administration and public catalog/creation. Runtime sign-in stays separately scoped.</summary>
public sealed class ProductSelection(IProductModuleRegistry registry, PlatformDbContext catalog)
{
    public string RequiredKey(string? key)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            if (registry.All.Count != 1) throw new ValidationException("Specify the product query parameter.");
            return registry.All[0].Key;
        }
        return registry.Get(key).Key;
    }
    public string? OptionalKey(string? key) => string.IsNullOrWhiteSpace(key) ? null : registry.Get(key).Key;
    public Task<PlatformProduct> RequiredAsync(string? key, CancellationToken ct = default)
    {
        var selected = RequiredKey(key);
        return catalog.Products.SingleAsync(p => p.Key == selected, ct);
    }
}
