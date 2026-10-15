using System.Diagnostics;
using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace CarSpaManagement.Api.Infrastructure.Platform.Products;

public sealed class ExternalCommandProductModule(string key, ExternalProductOptions settings) : IProductModule
{
    public string Key => key;
    public string Name => settings.Name;
    public string DatabasePrefix => settings.DatabasePrefix;
    public string TrialPlanCode => settings.TrialPlanCode;
    public SeatModel SeatModel => settings.SeatModel;
    public IReadOnlyList<SeatTypeDefinition> SeatTypes => settings.SeatTypes;
    public IReadOnlyList<FeatureDefinition> Features => settings.Features;
    public IReadOnlySet<string> Capabilities => settings.Capabilities;

    public async Task SeedCatalogAsync(PlatformDbContext catalog, PlatformProduct product, CancellationToken ct)
    {
        var seats = await ProductCatalogSeed.EnsureDefinitionsAsync(catalog, product, SeatTypes, Features, ct);
        foreach (var seed in settings.SeedPlans)
        {
            if (await catalog.Plans.AnyAsync(p => p.ProductId == product.Id && p.Code == seed.Code, ct)) continue;
            var now = DateTime.UtcNow;
            var plan = new Plan { Id = Guid.NewGuid(), ProductId = product.Id, Code = seed.Code, Name = seed.Name, SortOrder = seed.SortOrder, CreatedAt = now };
            foreach (var interval in new[] { BillingInterval.Month, BillingInterval.Year })
            {
                var version = new PlanVersion
                {
                    Id = Guid.NewGuid(), PlanId = plan.Id, Version = 1, Interval = interval, Currency = seed.Currency,
                    PriceMinor = interval == BillingInterval.Month ? seed.MonthlyPriceMinor : seed.YearlyPriceMinor,
                    IncludedSeats = SeatModel == SeatModel.None ? 0 : Math.Max(1, seed.IncludedSeats), CreatedAt = now, EffectiveFrom = now
                };
                foreach (var (code, price) in seed.SeatPrices)
                {
                    var seat = seats.Single(s => s.Code == code);
                    version.SeatPrices.Add(new PlanVersionSeatPrice
                    {
                        Id = Guid.NewGuid(), PlanVersionId = version.Id, SeatTypeId = seat.Id, SeatType = seat,
                        PriceMinor = interval == BillingInterval.Month ? price.MonthlyPriceMinor : price.YearlyPriceMinor
                    });
                }
                foreach (var (feature, value) in seed.Entitlements)
                    version.Entitlements.Add(new PlanEntitlement
                    {
                        Id = Guid.NewGuid(), PlanVersionId = version.Id, FeatureKey = feature,
                        ValueType = Features.Single(f => f.Key == feature).ValueType, Value = value
                    });
                plan.Versions.Add(version);
            }
            catalog.Plans.Add(plan);
        }
        await catalog.SaveChangesAsync(ct);
    }

    public async Task<string?> MigrateCompanyDatabaseAsync(ProvisionContext context, CancellationToken cancellationToken)
    {
        // No secrets in command arguments, logs, or exceptions. The connection is passed only in the child environment.
        var connection = context.AdminConnection(context.DatabaseName);
        var builder = new NpgsqlConnectionStringBuilder(connection);
        var rawHost = builder.Host ?? "localhost";
        var host = rawHost.Contains(':') ? $"[{rawHost}]" : rawHost;
        var url = $"postgresql://{Uri.EscapeDataString(builder.Username ?? "")}:{Uri.EscapeDataString(builder.Password ?? "")}@{host}:{builder.Port}/{Uri.EscapeDataString(context.DatabaseName)}";
        string Clean(string text)
        {
            foreach (var secret in new[] { connection, builder.ConnectionString, url, builder.Password, Uri.EscapeDataString(builder.Password ?? "") }
                         .Where(s => !string.IsNullOrEmpty(s)).OrderByDescending(s => s!.Length))
                text = text.Replace(secret!, "[REDACTED]", StringComparison.Ordinal);
            return text;
        }
        var start = new ProcessStartInfo(settings.MigrateCommand, settings.MigrateArguments)
        {
            UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true,
            CreateNoWindow = true, WorkingDirectory = settings.WorkingDirectory ?? Environment.CurrentDirectory
        };
        start.Environment["TROVO_COMPANY_ID"] = context.CompanyId.ToString();
        start.Environment["TROVO_COMPANY_CODE"] = context.Code;
        start.Environment["TROVO_COMPANY_NAME"] = context.Name;
        start.Environment["TROVO_DATABASE_NAME"] = context.DatabaseName;
        start.Environment["TROVO_ADMIN_DATABASE_URL"] = url;
        using var process = new Process { StartInfo = start };
        try { process.Start(); }
        catch { throw new InvalidOperationException("The product migration command could not be started."); }
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(settings.MigrateTimeoutSeconds));
        var stdout = process.StandardOutput.ReadToEndAsync(timeout.Token);
        var stderr = process.StandardError.ReadToEndAsync(timeout.Token);
        try
        {
            await process.WaitForExitAsync(timeout.Token);
            await Task.WhenAll(stdout, stderr).WaitAsync(timeout.Token);
        }
        catch (OperationCanceledException)
        {
            try { process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { }
            await process.WaitForExitAsync(CancellationToken.None);
            // Observe both readers before disposing, including caller cancellation.
            try { await Task.WhenAll(stdout, stderr); } catch (OperationCanceledException) { }
            cancellationToken.ThrowIfCancellationRequested();
            throw new InvalidOperationException("The product migration command timed out.");
        }
        var output = await stdout;
        var error = Clean(await stderr);
        if (process.ExitCode != 0)
            throw new InvalidOperationException(error.Length == 0 ? $"The product migration command exited with code {process.ExitCode}." : error[..Math.Min(1000, error.Length)]);
        var version = output.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).LastOrDefault();
        if (version is null) throw new InvalidOperationException("The product migration command returned no schema version.");
        version = Clean(version);
        if (version.Length > 150) throw new InvalidOperationException("The product schema version is too long.");
        return version;
    }
}
