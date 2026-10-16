using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Infrastructure.Platform.Products;
using CarSpaManagement.Api.Infrastructure.Security;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CarSpaManagement.Api.Controllers.Platform;

public sealed record PlatformCompanyListItem(
    Guid Id, string Code, string Name, string CompanyStatus, string? SubscriptionStatus, string? Plan, string? Interval,
    DateTime? CurrentPeriodEnd, DateTime? TrialEndsAt, bool MigrationFailed, DateTime CreatedAt, int Licences = 0, string? ProductKey = null, IReadOnlyList<SeatDto>? Seats = null);

/// <summary>User licences per app type.</summary>
public sealed record PlatformLicencesDto(int Android, int Windows, int Both);

/// <summary>Price per user licence per period, by app type.</summary>
public sealed record PlatformLicencePricesDto(long Android, long Windows, long Both);

public sealed record PlatformAddOnLine(string Code, string Name, int Quantity);

public sealed record PlatformCompanyDetail(
    Guid Id, string Code, string Name, string CompanyStatus, string DatabaseName, string? SchemaVersion, string? MigrationError,
    DateTime CreatedAt, DateTime? RegisteredAt, bool RegistrationCodeOpen,
    PlatformSubscriptionDto? Subscription, PlatformBillingAccountDto? BillingAccount,
    IReadOnlyDictionary<string, string> Features, int? SeatLimit, int? SeatsUsed,
    PlatformLicencesDto? LicencesUsed = null, string? ProductKey = null, IReadOnlyList<SeatDto>? SeatUsage = null);

public sealed record PlatformSubscriptionDto(
    Guid Id, string Status, string Plan, string PlanName, string Interval, long PriceMinor, string Currency,
    DateTime StartedAt, DateTime CurrentPeriodStart, DateTime CurrentPeriodEnd, DateTime? TrialEndsAt, DateTime? GraceEndsAt,
    bool CancelAtPeriodEnd, DateTime? RetainUntil, IReadOnlyList<PlatformAddOnLine> AddOns,
    PlatformLicencesDto? Licences = null, PlatformLicencePricesDto? LicencePrices = null, IReadOnlyList<SeatDto>? Seats = null);

public sealed record PlatformBillingAccountDto(string BillingName, string? BillingEmail, string? BillingPhone, string? Gstin, string? BillingAddress, string? StateCode);

public sealed record PlatformPlanRequest(string PlanCode, string Interval, Dictionary<string, int>? AddOns, DateTime PaidUntil,
    PlatformLicencesDto? Licences = null, Dictionary<string, int>? Seats = null);
public sealed record CreatePlatformCompanyRequest(string Name, PlatformPlanRequest? Plan);
public sealed record CreatePlatformCompanyResponse(Guid Id, string Code, string Name, string RegistrationCode, DateTime RegistrationCodeExpiresAt, string DatabaseName);
public sealed record RegistrationCodeResponse(string RegistrationCode, DateTime ExpiresAt);
public sealed record CompanyStatusRequest(string Action, string Reason);
public sealed record ChangeSubscriptionRequest(string? PlanCode, string? Interval, Dictionary<string, int>? AddOns, int? ExtendTrialDays, string Reason,
    PlatformLicencesDto? Licences = null, Dictionary<string, int>? Seats = null);
public sealed record CancelSubscriptionRequest(bool AtPeriodEnd, string Reason);
public sealed record PlanChangeBody(string PlanCode, string Interval, PlatformLicencesDto? Licences, Dictionary<string, int>? AddOns, string? Reason, Dictionary<string, int>? Seats = null);
public sealed record PlanChangePreviewDto(string Timing, long CurrentPeriodPriceMinor, long NewPeriodPriceMinor, long AmountNowMinor, string Currency,
    DateTime EffectiveAt);
public sealed record PlanChangeRequestDto(Guid Id, string Status, string Timing, string PlanCode, string Interval, PlatformLicencesDto Licences,
    Dictionary<string, int> AddOns, long CurrentPeriodPriceMinor, long NewPeriodPriceMinor, long AmountNowMinor, string Currency, DateTime EffectiveAt,
    DateTime ExpiresAt, string? Reason, string? RequestedByEmail, DateTime CreatedAt, DateTime? DecidedAt, string? DecidedByName,
    string? AdjustmentInvoiceNumber, IReadOnlyList<SeatDto>? Seats = null);

/// <summary>Trovo's view of companies: provisioning, registration codes, subscriptions, suspension. Every change is audited.</summary>
[ApiController]
[Route("api/platform/companies")]
[Authorize(Policy = PlatformPolicies.Any)]
public class PlatformCompaniesController(
    PlatformDbContext catalog,
    CompanyDatabaseProvisioner provisioner,
    SubscriptionService subscriptions,
    PlanChangeService planChanges,
    PlatformAuditService audit,
    IAesEncryptionService encryption,
    IConfiguration configuration,
    IOptions<PlatformOptions> options,
    ProductSelection products) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PlatformCompanyListItem>>> List([FromQuery] string? search, [FromQuery] string? status, CancellationToken cancellationToken, [FromQuery] string? product = null)
    {
        var productKey = products.OptionalKey(product);
        var query = catalog.Companies.AsNoTracking().Include(c => c.Product).Where(c => productKey == null || c.Product!.Key == productKey);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(c => c.Code.ToLower().Contains(term) || c.Name.ToLower().Contains(term));
        }

        var companies = await query.OrderBy(c => c.Code).ToListAsync(cancellationToken);
        var subs = await catalog.Subscriptions.AsNoTracking().Include(s => s.PlanVersion!).ThenInclude(v => v.Plan)
            .Where(s => s.IsCurrent).ToDictionaryAsync(s => s.CompanyId, cancellationToken);

        var items = companies.Select(c =>
        {
            subs.TryGetValue(c.Id, out var s);
            return new PlatformCompanyListItem(c.Id, c.Code, c.Name, c.Status.ToString(), s?.Status.ToString(), s?.PlanVersion?.Plan?.Code,
                s?.PlanVersion?.Interval.ToString(), s?.CurrentPeriodEnd, s?.TrialEndsAt, c.MigrationError is not null, c.CreatedAt,
                s?.Licences.Total ?? 0, c.Product!.Key, s?.PlanVersion is null ? [] : ProductSeats.Describe(s.PlanVersion, ProductSeats.Of(s)));
        });
        if (!string.IsNullOrWhiteSpace(status))
        {
            items = items.Where(i => string.Equals(i.SubscriptionStatus, status, StringComparison.OrdinalIgnoreCase)
                                     || string.Equals(i.CompanyStatus, status, StringComparison.OrdinalIgnoreCase));
        }
        return Ok(items.ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PlatformCompanyDetail>> Get(Guid id, CancellationToken cancellationToken)
    {
        var company = await catalog.Companies.AsNoTracking().Include(c => c.Product).FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (company is null) return NotFound();

        var subscription = await catalog.Subscriptions.AsNoTracking()
            .Include(s => s.PlanVersion!).ThenInclude(v => v.Plan)
            .Include(s => s.PlanVersion!).ThenInclude(v => v.Entitlements)
            .Include(s => s.Items).ThenInclude(i => i.AddOnPrice!).ThenInclude(p => p.AddOn)
            .FirstOrDefaultAsync(s => s.CompanyId == id && s.IsCurrent, cancellationToken);
        var account = await catalog.BillingAccounts.AsNoTracking().FirstOrDefaultAsync(b => b.CompanyId == id, cancellationToken);
        var codeOpen = await catalog.RegistrationCodes.AnyAsync(r => r.CompanyId == id && r.UsedAt == null && r.RevokedAt == null && r.ExpiresAt > DateTime.UtcNow, cancellationToken);
        var entitlements = subscription is null ? null : PlatformEntitlementService.Build(subscription, DateTime.UtcNow, company.Product!,
            await catalog.ProductFeatures.Where(f => f.ProductId == company.ProductId).ToListAsync(cancellationToken));
        var usage = company.Product!.SeatModel == SeatModel.PerType ? await CountActiveUsersAsync(company, cancellationToken) : null;

        return Ok(new PlatformCompanyDetail(
            company.Id, company.Code, company.Name, company.Status.ToString(), company.DatabaseName, company.SchemaVersion, company.MigrationError,
            company.CreatedAt, company.RegisteredAt, codeOpen,
            subscription is null ? null : ToDto(subscription),
            account is null ? null : new PlatformBillingAccountDto(account.BillingName, account.BillingEmail, account.BillingPhone, account.Gstin, account.BillingAddress, account.StateCode),
            entitlements?.Features ?? new Dictionary<string, string>(),
            entitlements?.SeatLimit,
            usage?.Total,
            usage is null ? null : new PlatformLicencesDto(usage.Value.Android, usage.Value.Windows, usage.Value.Both),
            company.Product.Key,
            usage is null ? null : (await catalog.ProductSeatTypes.Where(t => t.ProductId == company.ProductId).OrderBy(t => t.SortOrder).ToListAsync(cancellationToken))
                .Select(t => new SeatDto(t.Code, t.Name, ProductSeats.Legacy(usage.Value).GetValueOrDefault(t.Code), 0)).ToList()));
    }

    [HttpPost]
    [Authorize(Policy = PlatformPolicies.Support)]
    public async Task<ActionResult<CreatePlatformCompanyResponse>> Create([FromBody] CreatePlatformCompanyRequest request, CancellationToken cancellationToken, [FromQuery] string? product = null)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { error = "A company name is required." });
        try
        {
            var plan = request.Plan is null ? null : ToPlan(request.Plan);
            var created = await provisioner.CreateCompanyAsync(products.RequiredKey(product), request.Name, plan, cancellationToken);
            await audit.RecordAsync("company.created", created.Company.Id, null,
                new { created.Company.Code, created.Company.Name, plan = plan?.PlanCode ?? "trial" }, null, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, new CreatePlatformCompanyResponse(
                created.Company.Id, created.Company.Code, created.Company.Name, created.RegistrationCode,
                created.RegistrationCodeExpiresAt, created.Company.DatabaseName));
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{id:guid}/registration-code")]
    [Authorize(Policy = PlatformPolicies.Support)]
    public async Task<ActionResult<RegistrationCodeResponse>> NewRegistrationCode(Guid id, CancellationToken cancellationToken)
    {
        var company = await catalog.Companies.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (company is null) return NotFound();
        if (company.Status != PlatformCompanyStatus.AwaitingRegistration)
        {
            return Conflict(new { error = "This company is already registered." });
        }

        var (code, expiresAt) = await provisioner.IssueRegistrationCodeAsync(id, cancellationToken);
        await audit.RecordAsync("company.registration_code_issued", id, null, new { expiresAt }, null, cancellationToken);
        return Ok(new RegistrationCodeResponse(code, expiresAt));
    }

    [HttpPut("{id:guid}/status")]
    [Authorize(Policy = PlatformPolicies.Support)]
    public async Task<IActionResult> SetStatus(Guid id, [FromBody] CompanyStatusRequest request, CancellationToken cancellationToken)
    {
        return await Run(id, async actor =>
        {
            var before = await StatusOf(id, cancellationToken);
            switch (request.Action?.ToLowerInvariant())
            {
                case "suspend": await subscriptions.SuspendAsync(id, request.Reason, actor, cancellationToken); break;
                case "reactivate": await subscriptions.ReactivateAsync(id, request.Reason, actor, cancellationToken); break;
                default: throw new ValidationException("Action must be 'suspend' or 'reactivate'.");
            }
            await audit.RecordAsync($"company.{request.Action!.ToLowerInvariant()}", id, before, await StatusOf(id, cancellationToken), request.Reason, cancellationToken);
        });
    }

    [HttpPut("{id:guid}/subscription")]
    [Authorize(Policy = PlatformPolicies.Billing)]
    public async Task<IActionResult> ChangeSubscription(Guid id, [FromBody] ChangeSubscriptionRequest request, CancellationToken cancellationToken)
    {
        return await Run(id, async actor =>
        {
            if (string.IsNullOrWhiteSpace(request.Reason)) throw new ValidationException("A reason is required.");
            var changesTerms = request.PlanCode is not null || request.Interval is not null || request.AddOns is not null || request.Licences is not null || request.Seats is not null;
            if (changesTerms && await catalog.Companies.AnyAsync(c => c.Id == id && c.Status != PlatformCompanyStatus.AwaitingRegistration, cancellationToken))
            {
                throw new ConflictException("This company is registered, so its Owner must approve plan changes. Send the change for approval instead.");
            }
            var before = ToDto(await subscriptions.CurrentAsync(id, cancellationToken));
            var change = new SubscriptionChange(request.PlanCode, request.Interval is null ? null : ParseInterval(request.Interval),
                request.AddOns, request.ExtendTrialDays, ToCounts(request.Licences), request.Seats);
            var after = ToDto(await subscriptions.ChangeAsync(id, change, actor, cancellationToken));
            await audit.RecordAsync("subscription.changed", id, before, after, request.Reason, cancellationToken);
        });
    }

    /// <summary>What a change would cost the company now and when it would start (nothing is saved).</summary>
    [HttpPost("{id:guid}/plan-change/preview")]
    [Authorize(Policy = PlatformPolicies.Billing)]
    public async Task<ActionResult<PlanChangePreviewDto>> PreviewPlanChange(Guid id, [FromBody] PlanChangeBody body, CancellationToken cancellationToken)
    {
        if (!await catalog.Companies.AnyAsync(c => c.Id == id, cancellationToken)) return NotFound();
        try
        {
            var preview = await planChanges.PreviewAsync(id, ToTarget(body), cancellationToken);
            return Ok(new PlanChangePreviewDto(preview.Timing.ToString(), preview.CurrentPeriodPriceMinor, preview.NewPeriodPriceMinor,
                preview.AmountNowMinor, preview.Currency, preview.EffectiveAt));
        }
        catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
        catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }

    /// <summary>Sends a change to the company's Owner for approval. Nothing changes until they approve in the app.</summary>
    [HttpPost("{id:guid}/plan-change")]
    [Authorize(Policy = PlatformPolicies.Billing)]
    public async Task<ActionResult<PlanChangeRequestDto>> ProposePlanChange(Guid id, [FromBody] PlanChangeBody body, CancellationToken cancellationToken)
    {
        if (!await catalog.Companies.AnyAsync(c => c.Id == id, cancellationToken)) return NotFound();
        try
        {
            var request = await planChanges.ProposeAsync(id, ToTarget(body), body.Reason ?? string.Empty, AdminId(),
                User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value, cancellationToken);
            await audit.RecordAsync("subscription.change_proposed", id, null,
                new { request.Id, request.PlanCode, interval = request.Interval.ToString(), request.Licences, request.AddOnsJson, timing = request.Timing.ToString(), request.AmountNowMinor },
                body.Reason, cancellationToken);
            return Ok(await ToDtoAsync(request, cancellationToken));
        }
        catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
        catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (ConflictException ex) { return Conflict(new { error = ex.Message }); }
    }

    /// <summary>The company's plan change proposals, newest first.</summary>
    [HttpGet("{id:guid}/plan-changes")]
    public async Task<ActionResult<IReadOnlyList<PlanChangeRequestDto>>> PlanChanges(Guid id, CancellationToken cancellationToken)
    {
        await planChanges.OpenForCompanyAsync(id, cancellationToken); // closes expired proposals
        var requests = await catalog.PlanChangeRequests.AsNoTracking().Where(r => r.CompanyId == id)
            .OrderByDescending(r => r.CreatedAt).Take(20).ToListAsync(cancellationToken);
        var list = new List<PlanChangeRequestDto>();
        foreach (var request in requests) list.Add(await ToDtoAsync(request, cancellationToken));
        return Ok(list);
    }

    [HttpPost("{id:guid}/plan-change/{requestId:guid}/cancel")]
    [Authorize(Policy = PlatformPolicies.Billing)]
    public async Task<IActionResult> CancelPlanChange(Guid id, Guid requestId, CancellationToken cancellationToken)
    {
        return await Run(id, async _ =>
        {
            await planChanges.CancelAsync(id, requestId, cancellationToken);
            await audit.RecordAsync("subscription.change_withdrawn", id, null, new { requestId }, null, cancellationToken);
        });
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = PlatformPolicies.Billing)]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelSubscriptionRequest request, CancellationToken cancellationToken)
    {
        return await Run(id, async actor =>
        {
            var before = await StatusOf(id, cancellationToken);
            await subscriptions.CancelAsync(id, request.AtPeriodEnd, request.Reason, actor, cancellationToken);
            await audit.RecordAsync("subscription.canceled", id, before, new { request.AtPeriodEnd, status = await StatusOf(id, cancellationToken) }, request.Reason, cancellationToken);
        });
    }

    [HttpPut("{id:guid}/billing-account")]
    [Authorize(Policy = PlatformPolicies.Billing)]
    public async Task<IActionResult> UpdateBillingAccount(Guid id, [FromBody] PlatformBillingAccountDto request, CancellationToken cancellationToken)
    {
        var account = await catalog.BillingAccounts.FirstOrDefaultAsync(b => b.CompanyId == id, cancellationToken);
        if (account is null) return NotFound();
        if (string.IsNullOrWhiteSpace(request.BillingName)) return BadRequest(new { error = "A billing name is required." });

        var before = new PlatformBillingAccountDto(account.BillingName, account.BillingEmail, account.BillingPhone, account.Gstin, account.BillingAddress, account.StateCode);
        account.BillingName = request.BillingName.Trim();
        account.BillingEmail = request.BillingEmail?.Trim();
        account.BillingPhone = request.BillingPhone?.Trim();
        account.Gstin = string.IsNullOrWhiteSpace(request.Gstin) ? null : request.Gstin.Trim().ToUpperInvariant();
        account.BillingAddress = request.BillingAddress?.Trim();
        account.StateCode = request.StateCode?.Trim();
        account.UpdatedAt = DateTime.UtcNow;
        await catalog.SaveChangesAsync(cancellationToken);
        await audit.RecordAsync("billing_account.updated", id, before, request, null, cancellationToken);
        return NoContent();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private async Task<IActionResult> Run(Guid companyId, Func<SubscriptionActor, Task> action)
    {
        if (!await catalog.Companies.AnyAsync(c => c.Id == companyId)) return NotFound();
        try
        {
            await action(new SubscriptionActor(PlatformActorType.Admin, AdminId()));
            return NoContent();
        }
        catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
        catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (ConflictException ex) { return Conflict(new { error = ex.Message }); }
    }

    private async Task<string?> StatusOf(Guid companyId, CancellationToken cancellationToken) =>
        (await catalog.Subscriptions.AsNoTracking().FirstOrDefaultAsync(s => s.CompanyId == companyId && s.IsCurrent, cancellationToken))?.Status.ToString();

    private Guid? AdminId() =>
        Guid.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

    /// <summary>Active users per app access in the company's own database (counts only; nothing else is read).</summary>
    private async Task<LicenceCounts?> CountActiveUsersAsync(PlatformCompany company, CancellationToken cancellationToken)
    {
        if (!await catalog.Products.AnyAsync(p => p.Id == company.ProductId && p.Key == options.Value.ProductKey, cancellationToken)) return null;
        try
        {
            var contextOptions = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(CompanyConnectionStrings.ForCompanyLogin(configuration, company, encryption))
                .AddInterceptors(new TenantSessionInterceptor())
                .Options;
            await using var db = new AppDbContext(contextOptions, new FixedTenantContext(company.Id));
            var byAccess = await db.Users.Where(u => u.IsActive).GroupBy(u => u.AppAccess)
                .Select(g => new { Access = g.Key, Count = g.Count() })
                .ToDictionaryAsync(g => g.Access, g => g.Count, cancellationToken);
            return new LicenceCounts(byAccess.GetValueOrDefault(AppAccess.Android), byAccess.GetValueOrDefault(AppAccess.Windows),
                byAccess.GetValueOrDefault(AppAccess.Both));
        }
        catch
        {
            return null;
        }
    }

    internal static PlatformSubscriptionDto ToDto(Subscription s) => new(
        s.Id, s.Status.ToString(), s.PlanVersion?.Plan?.Code ?? string.Empty, s.PlanVersion?.Plan?.Name ?? string.Empty,
        s.PlanVersion?.Interval.ToString() ?? string.Empty, s.PlanVersion?.PriceMinor ?? 0, s.PlanVersion?.Currency ?? "INR",
        s.StartedAt, s.CurrentPeriodStart, s.CurrentPeriodEnd, s.TrialEndsAt, s.GraceEndsAt, s.CancelAtPeriodEnd, s.RetainUntil,
        s.Items.Where(i => i.EffectiveTo is null)
            .Select(i => new PlatformAddOnLine(i.AddOnPrice?.AddOn?.Code ?? string.Empty, i.AddOnPrice?.AddOn?.Name ?? string.Empty, i.Quantity))
            .ToList(),
        new PlatformLicencesDto(s.Licences.Android, s.Licences.Windows, s.Licences.Both),
        s.PlanVersion is null ? null : new PlatformLicencePricesDto(s.PlanVersion.UserPriceMinor(AppAccess.Android), s.PlanVersion.UserPriceMinor(AppAccess.Windows), s.PlanVersion.UserPriceMinor(AppAccess.Both)),
        s.PlanVersion is null ? [] : ProductSeats.Describe(s.PlanVersion, ProductSeats.Of(s)));

    private static LicenceCounts? ToCounts(PlatformLicencesDto? dto) => dto is null ? null : new LicenceCounts(dto.Android, dto.Windows, dto.Both);

    private static CompanyPlan ToPlan(PlatformPlanRequest plan) =>
        new(plan.PlanCode, ParseInterval(plan.Interval), plan.AddOns ?? new Dictionary<string, int>(), DateTime.SpecifyKind(plan.PaidUntil, DateTimeKind.Utc),
            ToCounts(plan.Licences), plan.Seats);

    private static PlanChangeTarget ToTarget(PlanChangeBody body)
    {
        if (string.IsNullOrWhiteSpace(body.PlanCode)) throw new ValidationException("Choose a plan.");
        var licences = body.Licences ?? new PlatformLicencesDto(0, 0, 0);
        return new PlanChangeTarget(body.PlanCode.Trim().ToLowerInvariant(), ParseInterval(body.Interval),
            new LicenceCounts(licences.Android, licences.Windows, licences.Both), body.AddOns ?? new Dictionary<string, int>(), body.Seats);
    }

    private async Task<PlanChangeRequestDto> ToDtoAsync(PlanChangeRequest r, CancellationToken cancellationToken)
    {
        var invoiceNumber = r.AdjustmentInvoiceId is { } invoiceId
            ? await catalog.BillingInvoices.Where(i => i.Id == invoiceId).Select(i => i.InvoiceNumber).FirstOrDefaultAsync(cancellationToken)
            : null;
        var productId = await catalog.Companies.Where(c => c.Id == r.CompanyId).Select(c => c.ProductId).SingleAsync(cancellationToken);
        var version = await catalog.PlanVersions.AsNoTracking()
            .Where(v => v.Plan!.ProductId == productId && v.Plan.Code == r.PlanCode && v.Interval == r.Interval)
            .OrderByDescending(v => v.Version).FirstOrDefaultAsync(cancellationToken);
        return new PlanChangeRequestDto(r.Id, r.Status.ToString(), r.Timing.ToString(), r.PlanCode, r.Interval.ToString(),
            new PlatformLicencesDto(r.AndroidLicences, r.WindowsLicences, r.BothLicences),
            SubscriptionService.AddOnsOf(r).ToDictionary(a => a.Key, a => a.Value), r.CurrentPeriodPriceMinor, r.NewPeriodPriceMinor,
            r.AmountNowMinor, r.Currency, r.EffectiveAt, r.ExpiresAt, r.Reason, r.RequestedByEmail, r.CreatedAt, r.DecidedAt, r.DecidedByName,
            invoiceNumber, version is null ? [] : ProductSeats.Describe(version, SubscriptionService.SeatsOf(r) ?? ProductSeats.Legacy(r.Licences)));
    }

    private static BillingInterval ParseInterval(string interval) =>
        Enum.TryParse<BillingInterval>(interval, ignoreCase: true, out var parsed)
            ? parsed
            : throw new ValidationException("Interval must be 'Month' or 'Year'.");
}
