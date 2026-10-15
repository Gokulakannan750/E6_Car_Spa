using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>The business settings in force: the server's defaults (PlatformOptions) overridden by what Trovo saved.</summary>
public sealed record EffectivePlatformSettings(int TrialDays, int GraceDays, int TrialLicences, int RenewalInvoiceDaysBefore, int FranchiseCodeMinutes = 60);

/// <summary>
/// Settings Trovo changes from the admin portal without a new server release. Each has limits so a typing mistake
/// cannot give a 10-year trial. Read through a short cache; a save takes effect at once on this server.
/// </summary>
public sealed class PlatformSettingsService(PlatformDbContext catalog, IOptions<PlatformOptions> options, IMemoryCache cache)
{
    public const string TrialDaysKey = "trial_days";
    public const string GraceDaysKey = "grace_days";
    public const string TrialLicencesKey = "trial_licences";
    public const string RenewalInvoiceDaysKey = "renewal_invoice_days_before";
    public const string FranchiseCodeMinutesKey = "franchise_code_minutes";

    /// <summary>Each setting with its allowed range.</summary>
    public static readonly IReadOnlyDictionary<string, (int Min, int Max)> Limits = new Dictionary<string, (int, int)>
    {
        [TrialDaysKey] = (1, 60),
        [GraceDaysKey] = (0, 60),
        [TrialLicencesKey] = (1, 50),
        [RenewalInvoiceDaysKey] = (1, 30),
        // 10 minutes to 7 days.
        [FranchiseCodeMinutesKey] = (10, 10_080),
    };

    private const string CacheKey = "platform:settings";
    private sealed record CachedSettings(Guid Revision, EffectivePlatformSettings Value);

    public async Task<EffectivePlatformSettings> GetAsync(CancellationToken cancellationToken = default, string? productKey = null)
    {
        var scopedCacheKey = CacheKey + ":" + productKey;
        var revision = cache.Get<Guid>(CacheKey + ":revision");
        if (cache.TryGetValue(scopedCacheKey, out CachedSettings? cached) && cached?.Revision == revision) return cached.Value;

        var saved = await catalog.Settings.AsNoTracking().ToDictionaryAsync(s => s.Key, s => s.Value, cancellationToken);
        int Read(string key, int fallback)
        {
            foreach (var candidate in productKey is null ? new[] { key } : new[] { $"{productKey}:{key}", key })
                if (saved.TryGetValue(candidate, out var text) && int.TryParse(text, out var value)
                    && value >= Limits[key].Min && value <= Limits[key].Max) return value;
            return fallback;
        }

        var defaults = options.Value;
        var effective = new EffectivePlatformSettings(
            Read(TrialDaysKey, defaults.TrialDays),
            Read(GraceDaysKey, defaults.GraceDays),
            Read(TrialLicencesKey, defaults.TrialLicences),
            Read(RenewalInvoiceDaysKey, defaults.RenewalInvoiceDaysBefore),
            Read(FranchiseCodeMinutesKey, defaults.FranchiseCodeMinutes));
        cache.Set(scopedCacheKey, new CachedSettings(revision, effective), TimeSpan.FromSeconds(30));
        return effective;
    }

    /// <summary>Saves the given settings (unknown keys and out-of-range values are refused). Returns the new values.</summary>
    public async Task<EffectivePlatformSettings> SaveAsync(IReadOnlyDictionary<string, int> values, string? changedBy, CancellationToken cancellationToken = default, string? productKey = null)
    {
        foreach (var (key, value) in values)
        {
            if (!Limits.TryGetValue(key, out var limit)) throw new ValidationException($"Unknown setting '{key}'.");
            if (value < limit.Min || value > limit.Max) throw new ValidationException($"'{key}' must be between {limit.Min} and {limit.Max}.");
            if (productKey is not null && productKey.Length + 1 + key.Length > 60) throw new ValidationException("The product setting key is too long.");
        }

        var now = DateTime.UtcNow;
        foreach (var (key, value) in values)
        {
            var savedKey = productKey is null ? key : $"{productKey}:{key}";
            var row = await catalog.Settings.FirstOrDefaultAsync(s => s.Key == savedKey, cancellationToken);
            if (row is null)
            {
                row = new PlatformSetting { Key = savedKey };
                catalog.Settings.Add(row);
            }
            row.Value = value.ToString();
            row.UpdatedAt = now;
            row.UpdatedBy = changedBy;
        }
        await catalog.SaveChangesAsync(cancellationToken);
        cache.Set(CacheKey + ":revision", Guid.NewGuid());
        return await GetAsync(cancellationToken, productKey);
    }
}
