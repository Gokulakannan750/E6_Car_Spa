using System.Security.Claims;
using System.Text.RegularExpressions;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Infrastructure.Platform.Products;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Controllers.Platform;

public sealed record PlanTermsDto(long CompanyFeeMinor, long AndroidUserPriceMinor, long WindowsUserPriceMinor, long BothUserPriceMinor, Dictionary<string, long>? SeatPrices = null);
public sealed record CreatePlanRequest(string Code, string Name, int MinimumLicences, PlanTermsDto Monthly, PlanTermsDto Yearly,
    Dictionary<string, string> Features, string Reason);
public sealed record UpdatePlanRequest(string? Name, bool? IsActive, string Reason);
public sealed record CreateAddOnRequest(string Code, string Name, string FeatureKey, string Value, long MonthlyPriceMinor, long YearlyPriceMinor, string Reason);
public sealed record UpdateAddOnRequest(string? Name, bool? IsActive, string Reason);
public sealed record PlatformSettingsDto(int TrialDays, int GraceDays, int TrialLicences, int RenewalInvoiceDaysBefore, int FranchiseCodeMinutes);
public sealed record UpdatePlatformSettingsRequest(int? TrialDays, int? GraceDays, int? TrialLicences, int? RenewalInvoiceDaysBefore, string Reason,
    int? FranchiseCodeMinutes = null);
public sealed record SignupOrderListItem(Guid Id, DateTime CreatedAt, string Start, string Status, string BusinessName, string OwnerName,
    string Mobile, string Email, string City, string State, string? PlanCode, string? Interval, int Licences, long AmountMinor, string Currency,
    Guid? CompanyId, string? CompanyCode, string? PaymentProvider, string? PaymentReference, string? FailureReason, DateTime? CompletedAt,
    DateTime ExpiresAt, string? FranchisorCode = null, bool FranchiseLinked = false, string? FranchiseProblem = null, string? ProductKey = null, IReadOnlyList<SeatDto>? Seats = null);

/// <summary>
/// Trovo manages its own catalog from the admin portal: new plans and add-ons, renaming or stopping one, and the
/// business settings (trial, grace). Prices change through new versions (PlatformAdminController). All audited.
/// </summary>
[ApiController]
[Route("api/platform")]
[Authorize(Policy = PlatformPolicies.Any)]
public partial class PlatformCatalogController(
    PlatformDbContext catalog,
    PlatformSettingsService settings,
    PlatformAuditService audit,
    ProductSelection products) : ControllerBase
{
    [GeneratedRegex("^[a-z][a-z0-9_]{1,38}$")]
    private static partial Regex CodePattern();

    [HttpPost("plans")]
    [Authorize(Policy = PlatformPolicies.Billing)]
    public async Task<IActionResult> CreatePlan([FromBody] CreatePlanRequest request, CancellationToken cancellationToken, [FromQuery] string? product = null)
    {
        return await Guarded(async () =>
        {
            RequireReason(request.Reason);
            var code = ValidCode(request.Code);
            var name = ValidName(request.Name);
            var selected = await products.RequiredAsync(product, cancellationToken);
            var productId = selected.Id;
            if (await catalog.Plans.AnyAsync(p => p.ProductId == productId && p.Code == code, cancellationToken))
            {
                throw new ConflictException($"A plan with the code '{code}' already exists.");
            }

            var now = DateTime.UtcNow;
            var plan = new Plan
            {
                Id = Guid.NewGuid(), ProductId = productId, Code = code, Name = name, CreatedAt = now,
                SortOrder = (await catalog.Plans.Where(p => p.ProductId == productId).MaxAsync(p => (int?)p.SortOrder, cancellationToken) ?? 0) + 1
            };
            foreach (var (interval, terms) in new[] { (BillingInterval.Month, request.Monthly), (BillingInterval.Year, request.Yearly) })
            {
                plan.Versions.Add(PlanVersionFactory.Create(plan, interval, ToTerms(terms, request.MinimumLicences, request.Features), now, await catalog.ProductSeatTypes.Where(t => t.ProductId == productId).ToListAsync(cancellationToken), selected, await catalog.ProductFeatures.Where(f => f.ProductId == productId).ToListAsync(cancellationToken)));
            }
            catalog.Plans.Add(plan);
            await catalog.SaveChangesAsync(cancellationToken);
            await audit.RecordAsync("plan.created", null, null, new { code, name, request.MinimumLicences, request.Monthly, request.Yearly, request.Features }, request.Reason, cancellationToken);
            return StatusCode(StatusCodes.Status201Created);
        });
    }

    [HttpPut("plans/{code}")]
    [Authorize(Policy = PlatformPolicies.Billing)]
    public async Task<IActionResult> UpdatePlan(string code, [FromBody] UpdatePlanRequest request, CancellationToken cancellationToken, [FromQuery] string? product = null)
    {
        return await Guarded(async () =>
        {
            RequireReason(request.Reason);
            var productId = (await products.RequiredAsync(product, cancellationToken)).Id;
            var plan = await catalog.Plans.FirstOrDefaultAsync(p => p.ProductId == productId && p.Code == code, cancellationToken)
                ?? throw new NotFoundException("Plan not found.");
            var before = new { plan.Name, plan.IsActive };
            if (request.Name is not null) plan.Name = ValidName(request.Name);
            if (request.IsActive is { } active)
            {
                if (!active && plan.IsActive && await catalog.Plans.CountAsync(p => p.ProductId == productId && p.IsActive, cancellationToken) == 1)
                {
                    throw new ValidationException("At least one plan must stay on sale.");
                }
                plan.IsActive = active;
            }
            plan.UpdatedAt = DateTime.UtcNow;
            await catalog.SaveChangesAsync(cancellationToken);
            await audit.RecordAsync("plan.updated", null, before, new { plan.Name, plan.IsActive }, request.Reason, cancellationToken);
            return NoContent();
        });
    }

    [HttpPost("addons")]
    [Authorize(Policy = PlatformPolicies.Billing)]
    public async Task<IActionResult> CreateAddOn([FromBody] CreateAddOnRequest request, CancellationToken cancellationToken, [FromQuery] string? product = null)
    {
        return await Guarded(async () =>
        {
            RequireReason(request.Reason);
            var code = ValidCode(request.Code);
            var name = ValidName(request.Name);
            var selected = await products.RequiredAsync(product, cancellationToken);
            var definition = await catalog.ProductFeatures.SingleOrDefaultAsync(f => f.ProductId == selected.Id && f.Key == request.FeatureKey, cancellationToken);
            var type = definition?.ValueType;
            if (definition is null || request.FeatureKey == FeatureKeys.UsersMaxActive)
            {
                throw new ValidationException("Choose one of the software's features for the add-on (user licences are part of the plan).");
            }
            var value = type == EntitlementValueType.Bool ? "true" : request.Value?.Trim() ?? string.Empty;
            if (type == EntitlementValueType.Int && (!int.TryParse(value, out var perUnit) || perUnit is < 1 or > 1000))
            {
                throw new ValidationException("Enter how much one unit of the add-on adds (1 to 1000).");
            }
            foreach (var price in new[] { request.MonthlyPriceMinor, request.YearlyPriceMinor })
            {
                if (price < 0 || price > PlanVersionFactory.MaxPriceMinor) throw new ValidationException("Prices must be between ₹0 and ₹1,00,00,000.");
            }

            var productId = (await products.RequiredAsync(product, cancellationToken)).Id;
            if (await catalog.AddOns.AnyAsync(a => a.ProductId == productId && a.Code == code, cancellationToken))
            {
                throw new ConflictException($"An add-on with the code '{code}' already exists.");
            }

            var now = DateTime.UtcNow;
            var addOn = new AddOn { Id = Guid.NewGuid(), ProductId = productId, Code = code, Name = name, FeatureKey = request.FeatureKey, Value = value, CreatedAt = now };
            foreach (var (interval, price) in new[] { (BillingInterval.Month, request.MonthlyPriceMinor), (BillingInterval.Year, request.YearlyPriceMinor) })
            {
                addOn.Prices.Add(new AddOnPrice
                {
                    Id = Guid.NewGuid(), AddOnId = addOn.Id, Version = 1, Interval = interval, Currency = "INR",
                    UnitPriceMinor = price, EffectiveFrom = now, CreatedAt = now
                });
            }
            catalog.AddOns.Add(addOn);
            await catalog.SaveChangesAsync(cancellationToken);
            await audit.RecordAsync("addon.created", null, null, new { code, name, request.FeatureKey, value, request.MonthlyPriceMinor, request.YearlyPriceMinor }, request.Reason, cancellationToken);
            return StatusCode(StatusCodes.Status201Created);
        });
    }

    [HttpPut("addons/{code}")]
    [Authorize(Policy = PlatformPolicies.Billing)]
    public async Task<IActionResult> UpdateAddOn(string code, [FromBody] UpdateAddOnRequest request, CancellationToken cancellationToken, [FromQuery] string? product = null)
    {
        return await Guarded(async () =>
        {
            RequireReason(request.Reason);
            var productId = (await products.RequiredAsync(product, cancellationToken)).Id;
            var addOn = await catalog.AddOns.FirstOrDefaultAsync(a => a.ProductId == productId && a.Code == code, cancellationToken)
                ?? throw new NotFoundException("Add-on not found.");
            var before = new { addOn.Name, addOn.IsActive };
            if (request.Name is not null) addOn.Name = ValidName(request.Name);
            if (request.IsActive is { } active) addOn.IsActive = active; // stopping sales never removes it from companies that have it
            await catalog.SaveChangesAsync(cancellationToken);
            await audit.RecordAsync("addon.updated", null, before, new { addOn.Name, addOn.IsActive }, request.Reason, cancellationToken);
            return NoContent();
        });
    }

    [HttpGet("settings")]
    public async Task<ActionResult<PlatformSettingsDto>> GetSettings(CancellationToken cancellationToken, [FromQuery] string? product = null) =>
        Ok(ToDto(await settings.GetAsync(cancellationToken, products.RequiredKey(product))));

    [HttpPut("settings")]
    [Authorize(Policy = PlatformPolicies.Owner)]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdatePlatformSettingsRequest request, CancellationToken cancellationToken, [FromQuery] string? product = null)
    {
        return await Guarded(async () =>
        {
            RequireReason(request.Reason);
            var values = new Dictionary<string, int>();
            if (request.TrialDays is { } trial) values[PlatformSettingsService.TrialDaysKey] = trial;
            if (request.GraceDays is { } grace) values[PlatformSettingsService.GraceDaysKey] = grace;
            if (request.TrialLicences is { } licences) values[PlatformSettingsService.TrialLicencesKey] = licences;
            if (request.RenewalInvoiceDaysBefore is { } renewal) values[PlatformSettingsService.RenewalInvoiceDaysKey] = renewal;
            if (request.FranchiseCodeMinutes is { } codeMinutes) values[PlatformSettingsService.FranchiseCodeMinutesKey] = codeMinutes;
            if (values.Count == 0) throw new ValidationException("Nothing to change.");

            var before = ToDto(await settings.GetAsync(cancellationToken, products.RequiredKey(product)));
            var after = ToDto(await settings.SaveAsync(values, User.FindFirstValue(ClaimTypes.Email), cancellationToken, products.RequiredKey(product)));
            await audit.RecordAsync("settings.updated", null, before, after, request.Reason, cancellationToken);
            return Ok(after);
        });
    }

    /// <summary>
    /// Orders from the public sign-up website, newest first. "NeedsAttention" means paid but the company could not be
    /// created: Trovo creates it by hand (New company, already paid) and calls the customer.
    /// </summary>
    [HttpGet("signups")]
    public async Task<ActionResult<IReadOnlyList<SignupOrderListItem>>> Signups([FromQuery] string? status, CancellationToken cancellationToken, [FromQuery] string? product = null)
    {
        var productKey = products.OptionalKey(product);
        var productRows = await catalog.Products.ToDictionaryAsync(p => p.Id, p => p.Key, cancellationToken);
        var query = catalog.SignupOrders.AsNoTracking().Where(o => productKey == null || catalog.Products.Any(p => p.Id == o.ProductId && p.Key == productKey));
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<SignupStatus>(status, ignoreCase: true, out var wanted)) return BadRequest(new { error = "Unknown status." });
            query = query.Where(o => o.Status == wanted);
        }
        var orders = await query.OrderByDescending(o => o.CreatedAt).Take(500).ToListAsync(cancellationToken);
        var companyIds = orders.Where(o => o.CompanyId != null).Select(o => o.CompanyId!.Value).ToList();
        var codeIds = orders.Where(o => o.FranchiseSignupCodeId != null).Select(o => o.FranchiseSignupCodeId!.Value).ToList();
        var franchisors = await catalog.FranchiseSignupCodes.Where(c => codeIds.Contains(c.Id)).Select(c => new { c.Id, c.FranchisorCompanyId })
            .ToDictionaryAsync(c => c.Id, c => c.FranchisorCompanyId, cancellationToken);
        companyIds.AddRange(franchisors.Values);
        var codes = await catalog.Companies.Where(c => companyIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Code, cancellationToken);
        var now = DateTime.UtcNow;
        return Ok(orders.Select(o => new SignupOrderListItem(o.Id, o.CreatedAt, o.Start.ToString(),
            (o.Status == SignupStatus.AwaitingPayment && o.ExpiresAt <= now ? SignupStatus.Expired : o.Status).ToString(),
            o.BusinessName, o.OwnerName, o.Mobile, o.Email, o.City, o.State, o.PlanCode, o.Interval?.ToString(),
            o.Licences.Android + o.Licences.Windows + o.Licences.Both, o.AmountMinor, o.Currency, o.CompanyId,
            o.CompanyId is { } id && codes.TryGetValue(id, out var code) ? code : null,
            o.PaymentProvider, o.PaymentReference, o.FailureReason, o.CompletedAt, o.ExpiresAt,
            o.FranchiseSignupCodeId is { } fc && franchisors.TryGetValue(fc, out var franchisor) && codes.TryGetValue(franchisor, out var fcode) ? fcode : null,
            o.FranchiseLinkId is not null, o.FranchiseProblem, productRows[o.ProductId], ProductSeats.OrderSnapshot(o))).ToList());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private async Task<IActionResult> Guarded(Func<Task<IActionResult>> action)
    {
        try { return await action(); }
        catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
        catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (ConflictException ex) { return Conflict(new { error = ex.Message }); }
    }

    private static PlanTerms ToTerms(PlanTermsDto dto, int minimumLicences, IReadOnlyDictionary<string, string>? features) =>
        new(dto.CompanyFeeMinor, minimumLicences, dto.AndroidUserPriceMinor, dto.WindowsUserPriceMinor, dto.BothUserPriceMinor,
            features ?? new Dictionary<string, string>(), dto.SeatPrices);

    private static PlatformSettingsDto ToDto(EffectivePlatformSettings s) => new(s.TrialDays, s.GraceDays, s.TrialLicences, s.RenewalInvoiceDaysBefore, s.FranchiseCodeMinutes);

    private static string ValidCode(string? code)
    {
        var trimmed = code?.Trim().ToLowerInvariant() ?? string.Empty;
        return CodePattern().IsMatch(trimmed)
            ? trimmed
            : throw new ValidationException("The code must be 2–39 lowercase letters, digits or underscores, starting with a letter (e.g. enterprise).");
    }

    private static string ValidName(string? name)
    {
        var trimmed = name?.Trim() ?? string.Empty;
        return trimmed.Length is >= 2 and <= 100 ? trimmed : throw new ValidationException("The name must be 2 to 100 characters.");
    }

    private static void RequireReason(string? reason)
    {
        if (string.IsNullOrWhiteSpace(reason)) throw new ValidationException("A reason is required.");
    }
}
