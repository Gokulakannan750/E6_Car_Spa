using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CarSpaManagement.Api.Controllers.Platform;

public sealed record PlatformEntitlementDto(string FeatureKey, string Value);
public sealed record PlatformPlanVersionDto(Guid Id, int Version, string Interval, string Currency, long PriceMinor, int IncludedSeats,
    DateTime EffectiveFrom, DateTime? EffectiveTo, IReadOnlyList<PlatformEntitlementDto> Entitlements);
public sealed record PlatformPlanDto(Guid Id, string Code, string Name, bool IsActive, IReadOnlyList<PlatformPlanVersionDto> Versions);
public sealed record PlatformAddOnPriceDto(Guid Id, int Version, string Interval, string Currency, long UnitPriceMinor, DateTime EffectiveFrom, DateTime? EffectiveTo);
public sealed record PlatformAddOnDto(Guid Id, string Code, string Name, string FeatureKey, string Value, bool IsActive, IReadOnlyList<PlatformAddOnPriceDto> Prices);
public sealed record PlatformCatalogDto(IReadOnlyList<PlatformPlanDto> Plans, IReadOnlyList<PlatformAddOnDto> AddOns, bool ChargesGst, decimal GstRatePercent);
public sealed record NewPlanVersionRequest(string Interval, long PriceMinor, int IncludedSeats, Dictionary<string, string> Entitlements, string Reason);
public sealed record NewAddOnPriceRequest(string Interval, long UnitPriceMinor, string Reason);

public sealed record PlatformDashboardDto(
    int Companies, IReadOnlyDictionary<string, int> SubscriptionsByStatus, long MonthlyRecurringRevenueMinor,
    int OpenInvoices, long AmountDueMinor, int AwaitingRegistration, int MigrationFailures, IReadOnlyList<PlatformAuditDto> RecentActivity);
public sealed record PlatformAuditDto(Guid Id, DateTime CreatedAt, string? AdministratorEmail, string Action, Guid? TargetCompanyId,
    string? BeforeValues, string? AfterValues, string? Reason, string? IpAddress);
public sealed record PlatformMigrationStatusDto(string Code, string Name, string? SchemaVersion, DateTime? LastMigratedAt, string? MigrationError);

/// <summary>Trovo's dashboard, plans and prices, the audit log and maintenance.</summary>
[ApiController]
[Route("api/platform")]
[Authorize(Policy = PlatformPolicies.Any)]
public class PlatformAdminController(
    PlatformDbContext catalog,
    CompanyDatabaseProvisioner provisioner,
    PlatformAuditService audit,
    IOptions<PlatformOptions> options) : ControllerBase
{
    [HttpGet("dashboard")]
    public async Task<ActionResult<PlatformDashboardDto>> Dashboard(CancellationToken cancellationToken)
    {
        var companies = await catalog.Companies.AsNoTracking().Where(c => c.Product!.Key == options.Value.ProductKey).ToListAsync(cancellationToken);
        var subscriptions = await catalog.Subscriptions.AsNoTracking()
            .Include(s => s.PlanVersion)
            .Include(s => s.Items).ThenInclude(i => i.AddOnPrice)
            .Where(s => s.IsCurrent).ToListAsync(cancellationToken);
        var openInvoices = await catalog.BillingInvoices.AsNoTracking().Where(i => i.Status == BillingInvoiceStatus.Open).ToListAsync(cancellationToken);
        var recent = await catalog.AuditLogs.AsNoTracking().OrderByDescending(a => a.CreatedAt).Take(10).ToListAsync(cancellationToken);

        // Monthly recurring revenue: paying subscriptions only, yearly prices counted per month.
        var now = DateTime.UtcNow;
        long Monthly(long amount, BillingInterval interval) => interval == BillingInterval.Year ? amount / 12 : amount;
        var mrr = subscriptions
            .Where(s => s.Status is SubscriptionStatus.Active or SubscriptionStatus.PastDue && s.PlanVersion is not null)
            .Sum(s => Monthly(s.PlanVersion!.PriceMinor, s.PlanVersion.Interval)
                      + s.Items.Where(i => i.EffectiveTo is null || i.EffectiveTo > now)
                          .Sum(i => Monthly(i.AddOnPrice!.UnitPriceMinor * i.Quantity, i.AddOnPrice.Interval)));

        return Ok(new PlatformDashboardDto(
            companies.Count,
            subscriptions.GroupBy(s => s.Status.ToString()).ToDictionary(g => g.Key, g => g.Count()),
            mrr,
            openInvoices.Count,
            openInvoices.Sum(i => i.AmountDueMinor),
            companies.Count(c => c.Status == PlatformCompanyStatus.AwaitingRegistration),
            companies.Count(c => c.MigrationError is not null),
            recent.Select(ToDto).ToList()));
    }

    [HttpGet("plans")]
    public async Task<ActionResult<PlatformCatalogDto>> Plans(CancellationToken cancellationToken)
    {
        var productKey = options.Value.ProductKey;
        var plans = await catalog.Plans.AsNoTracking().Include(p => p.Versions).ThenInclude(v => v.Entitlements)
            .Where(p => p.Product!.Key == productKey).OrderBy(p => p.SortOrder).ToListAsync(cancellationToken);
        var productId = await catalog.Products.Where(p => p.Key == productKey).Select(p => p.Id).FirstAsync(cancellationToken);
        var addOns = await catalog.AddOns.AsNoTracking().Include(a => a.Prices)
            .Where(a => a.ProductId == productId).OrderBy(a => a.Code).ToListAsync(cancellationToken);

        return Ok(new PlatformCatalogDto(
            plans.Select(p => new PlatformPlanDto(p.Id, p.Code, p.Name, p.IsActive,
                p.Versions.OrderBy(v => v.Interval).ThenByDescending(v => v.Version).Select(v => new PlatformPlanVersionDto(
                    v.Id, v.Version, v.Interval.ToString(), v.Currency, v.PriceMinor, v.IncludedSeats, v.EffectiveFrom, v.EffectiveTo,
                    v.Entitlements.OrderBy(e => e.FeatureKey).Select(e => new PlatformEntitlementDto(e.FeatureKey, e.Value)).ToList())).ToList())).ToList(),
            addOns.Select(a => new PlatformAddOnDto(a.Id, a.Code, a.Name, a.FeatureKey, a.Value, a.IsActive,
                a.Prices.OrderBy(p => p.Interval).ThenByDescending(p => p.Version).Select(p => new PlatformAddOnPriceDto(
                    p.Id, p.Version, p.Interval.ToString(), p.Currency, p.UnitPriceMinor, p.EffectiveFrom, p.EffectiveTo)).ToList())).ToList(),
            options.Value.ChargesGst,
            options.Value.GstRatePercent));
    }

    /// <summary>
    /// A new price/features version of a plan for one interval. The current version stops being offered; existing
    /// subscribers keep their version until their plan is changed.
    /// </summary>
    [HttpPost("plans/{code}/versions")]
    [Authorize(Policy = PlatformPolicies.Billing)]
    public async Task<IActionResult> NewPlanVersion(string code, [FromBody] NewPlanVersionRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { error = "A reason is required." });
        if (request.PriceMinor < 0 || request.IncludedSeats < 1) return BadRequest(new { error = "Price must be zero or more and seats at least 1." });
        if (!Enum.TryParse<BillingInterval>(request.Interval, true, out var interval)) return BadRequest(new { error = "Interval must be 'Month' or 'Year'." });
        foreach (var key in request.Entitlements.Keys)
        {
            if (!FeatureKeys.All.ContainsKey(key)) return BadRequest(new { error = $"Unknown feature '{key}'." });
        }

        var plan = await catalog.Plans.Include(p => p.Versions)
            .FirstOrDefaultAsync(p => p.Product!.Key == options.Value.ProductKey && p.Code == code, cancellationToken);
        if (plan is null) return NotFound();

        var now = DateTime.UtcNow;
        var current = plan.Versions.Where(v => v.Interval == interval && v.EffectiveTo == null).ToList();
        foreach (var old in current) old.EffectiveTo = now;

        var version = new PlanVersion
        {
            Id = Guid.NewGuid(),
            PlanId = plan.Id,
            Version = plan.Versions.Where(v => v.Interval == interval).Select(v => v.Version).DefaultIfEmpty(0).Max() + 1,
            Interval = interval,
            Currency = "INR",
            PriceMinor = request.PriceMinor,
            IncludedSeats = request.IncludedSeats,
            EffectiveFrom = now,
            CreatedAt = now
        };
        foreach (var (key, type) in FeatureKeys.All)
        {
            var value = key == FeatureKeys.UsersMaxActive
                ? request.IncludedSeats.ToString()
                : request.Entitlements.TryGetValue(key, out var v) ? v : (type == EntitlementValueType.Bool ? "false" : "0");
            if (key == FeatureKeys.FranchiseNetworkBranches) continue; // comes from the Franchise network add-on
            version.Entitlements.Add(new PlanEntitlement { Id = Guid.NewGuid(), PlanVersionId = version.Id, FeatureKey = key, ValueType = type, Value = value });
        }
        catalog.PlanVersions.Add(version);
        await catalog.SaveChangesAsync(cancellationToken);
        await audit.RecordAsync("plan.version_created", null,
            current.Select(c => new { c.Version, c.PriceMinor, c.IncludedSeats }),
            new { plan = code, version.Version, interval = interval.ToString(), version.PriceMinor, version.IncludedSeats, request.Entitlements },
            request.Reason, cancellationToken);
        return StatusCode(StatusCodes.Status201Created);
    }

    [HttpPost("addons/{code}/prices")]
    [Authorize(Policy = PlatformPolicies.Billing)]
    public async Task<IActionResult> NewAddOnPrice(string code, [FromBody] NewAddOnPriceRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { error = "A reason is required." });
        if (request.UnitPriceMinor < 0) return BadRequest(new { error = "The price must be zero or more." });
        if (!Enum.TryParse<BillingInterval>(request.Interval, true, out var interval)) return BadRequest(new { error = "Interval must be 'Month' or 'Year'." });

        var productId = await catalog.Products.Where(p => p.Key == options.Value.ProductKey).Select(p => p.Id).FirstAsync(cancellationToken);
        var addOn = await catalog.AddOns.Include(a => a.Prices).FirstOrDefaultAsync(a => a.ProductId == productId && a.Code == code, cancellationToken);
        if (addOn is null) return NotFound();

        var now = DateTime.UtcNow;
        var current = addOn.Prices.Where(p => p.Interval == interval && p.EffectiveTo == null).ToList();
        foreach (var old in current) old.EffectiveTo = now;
        var price = new AddOnPrice
        {
            Id = Guid.NewGuid(), AddOnId = addOn.Id, Interval = interval, Currency = "INR", UnitPriceMinor = request.UnitPriceMinor,
            Version = addOn.Prices.Where(p => p.Interval == interval).Select(p => p.Version).DefaultIfEmpty(0).Max() + 1,
            EffectiveFrom = now, CreatedAt = now
        };
        catalog.AddOnPrices.Add(price);
        await catalog.SaveChangesAsync(cancellationToken);
        await audit.RecordAsync("addon.price_created", null, current.Select(c => new { c.Version, c.UnitPriceMinor }),
            new { addOn = code, price.Version, interval = interval.ToString(), price.UnitPriceMinor }, request.Reason, cancellationToken);
        return StatusCode(StatusCodes.Status201Created);
    }

    [HttpGet("audit-logs")]
    [Authorize(Policy = PlatformPolicies.Owner)]
    public async Task<ActionResult<IReadOnlyList<PlatformAuditDto>>> AuditLogs([FromQuery] Guid? companyId, [FromQuery] int page = 1, CancellationToken cancellationToken = default)
    {
        var query = catalog.AuditLogs.AsNoTracking().AsQueryable();
        if (companyId is not null) query = query.Where(a => a.TargetCompanyId == companyId);
        var rows = await query.OrderByDescending(a => a.CreatedAt).Skip((Math.Max(page, 1) - 1) * 50).Take(50).ToListAsync(cancellationToken);
        return Ok(rows.Select(ToDto).ToList());
    }

    [HttpGet("migrations")]
    [Authorize(Policy = PlatformPolicies.Owner)]
    public async Task<ActionResult<IReadOnlyList<PlatformMigrationStatusDto>>> Migrations(CancellationToken cancellationToken) =>
        Ok(await catalog.Companies.AsNoTracking().Where(c => c.Product!.Key == options.Value.ProductKey).OrderBy(c => c.Code)
            .Select(c => new PlatformMigrationStatusDto(c.Code, c.Name, c.SchemaVersion, c.LastMigratedAt, c.MigrationError))
            .ToListAsync(cancellationToken));

    [HttpPost("migrations/run")]
    [Authorize(Policy = PlatformPolicies.Owner)]
    public async Task<ActionResult<IReadOnlyList<PlatformMigrationStatusDto>>> RunMigrations(CancellationToken cancellationToken)
    {
        var companies = await provisioner.MigrateAllAsync(cancellationToken);
        await audit.RecordAsync("migrations.run", null, null,
            new { total = companies.Count, failed = companies.Count(c => c.MigrationError is not null) }, null, cancellationToken);
        return Ok(companies.Select(c => new PlatformMigrationStatusDto(c.Code, c.Name, c.SchemaVersion, c.LastMigratedAt, c.MigrationError)).ToList());
    }

    private static PlatformAuditDto ToDto(PlatformAuditLog a) =>
        new(a.Id, a.CreatedAt, a.AdministratorEmail, a.Action, a.TargetCompanyId, a.BeforeValues, a.AfterValues, a.Reason, a.IpAddress);
}
