using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CarSpaManagement.Api.Controllers.Platform;

public sealed record PublicPricesDto(long CompanyFeeMinor, long AndroidUserPriceMinor, long WindowsUserPriceMinor, long BothUserPriceMinor);
public sealed record PublicPlanDto(string Code, string Name, int MinimumLicences, IReadOnlyList<string> Modules, PublicPricesDto? Monthly, PublicPricesDto? Yearly);
public sealed record PublicAddOnDto(string Code, string Name, string FeatureKey, bool IsPack, int PerUnit, long? MonthlyPriceMinor, long? YearlyPriceMinor);
public sealed record PublicCatalogDto(
    string ProductName,
    IReadOnlyList<PublicPlanDto> Plans,
    IReadOnlyList<PublicAddOnDto> AddOns,
    int TrialDays,
    int TrialLicences,
    int GraceDays,
    bool ChargesGst,
    decimal? GstRatePercent,
    bool TestPayments,
    string SellerName,
    string SellerPhone,
    string SellerEmail);

public sealed record PublicLicencesDto(int Android, int Windows, int Both);
public sealed record PublicPlanChoiceDto(string PlanCode, string Interval, PublicLicencesDto Licences, Dictionary<string, int>? AddOns);
public sealed record PublicSignupRequest(SignupBusiness Business, bool StartTrial, PublicPlanChoiceDto? Plan, bool AcceptTerms,
    string? FranchiseCode = null, bool FranchiseConsent = false);
public sealed record PublicFranchiseCodeRequest(string Code);
public sealed record PublicOrderTokenRequest(string Token);

/// <summary>
/// The public sign-up website's API: prices, a quote, a sign-up (free trial or paid order) and, on test servers, the
/// test payment. Anonymous, rate-limited, and off unless <c>Platform:SignupEnabled</c> is set.
/// </summary>
[ApiController]
[Route("api/public")]
[AllowAnonymous]
public class PublicSignupController(
    PlatformDbContext catalog,
    CompanyDatabaseProvisioner provisioner,
    PriceQuoteService quotes,
    SignupService signups,
    FranchiseSignupCodeRedemption franchiseCodes,
    PlatformSettingsService platformSettings,
    IOptions<PlatformOptions> options) : ControllerBase
{
    private PlatformOptions Settings => options.Value;

    /// <summary>Plans, licence prices and add-ons on sale now, for the pricing page.</summary>
    [HttpGet("catalog")]
    [EnableRateLimiting("public-read")]
    public async Task<ActionResult<PublicCatalogDto>> Catalog(CancellationToken cancellationToken)
    {
        if (!Settings.SignupEnabled) return NotFound();
        var product = await provisioner.EnsureCatalogAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var plans = await catalog.Plans.AsNoTracking().Include(p => p.Versions).ThenInclude(v => v.Entitlements)
            .Where(p => p.ProductId == product.Id && p.IsActive).OrderBy(p => p.SortOrder).ToListAsync(cancellationToken);
        var addOns = await catalog.AddOns.AsNoTracking().Include(a => a.Prices)
            .Where(a => a.ProductId == product.Id && a.IsActive).OrderBy(a => a.Code).ToListAsync(cancellationToken);
        var effective = await platformSettings.GetAsync(cancellationToken);

        static PublicPricesDto? Prices(PlanVersion? v) =>
            v is null ? null : new PublicPricesDto(v.PriceMinor, v.AndroidUserPriceMinor, v.WindowsUserPriceMinor, v.BothUserPriceMinor);
        long? AddOnPrice(AddOn a, BillingInterval interval) =>
            a.Prices.Where(p => p.Interval == interval && p.EffectiveFrom <= now && (p.EffectiveTo == null || p.EffectiveTo > now))
                .OrderByDescending(p => p.Version).Select(p => (long?)p.UnitPriceMinor).FirstOrDefault();

        return Ok(new PublicCatalogDto(
            product.Name,
            plans.Select(p =>
            {
                var month = PriceQuoteService.CurrentVersion(p, BillingInterval.Month, now);
                var year = PriceQuoteService.CurrentVersion(p, BillingInterval.Year, now);
                var reference = month ?? year;
                return new PublicPlanDto(p.Code, p.Name, reference?.IncludedSeats ?? 1,
                    reference?.Entitlements.Where(e => e.Value == "true").Select(e => e.FeatureKey).OrderBy(k => k).ToList() ?? [],
                    Prices(month), Prices(year));
            }).Where(p => p.Monthly is not null || p.Yearly is not null).ToList(),
            addOns.Select(a => new PublicAddOnDto(a.Code, a.Name, a.FeatureKey, a.Value != "true", int.TryParse(a.Value, out var unit) ? unit : 1,
                AddOnPrice(a, BillingInterval.Month), AddOnPrice(a, BillingInterval.Year))).ToList(),
            effective.TrialDays,
            effective.TrialLicences,
            effective.GraceDays,
            Settings.ChargesGst,
            Settings.ChargesGst ? Settings.GstRatePercent : null,
            signups.TestPaymentsAllowed,
            Settings.SellerName,
            Settings.SellerPhone,
            Settings.SellerEmail));
    }

    /// <summary>The price of a choice, worked out by the server (the website shows it before the customer pays).</summary>
    [HttpPost("signup/quote")]
    [EnableRateLimiting("public-read")]
    public async Task<ActionResult<PriceQuote>> Quote([FromBody] PublicPlanChoiceDto request, CancellationToken cancellationToken)
    {
        if (!Settings.SignupEnabled) return NotFound();
        try
        {
            var product = await provisioner.EnsureCatalogAsync(cancellationToken);
            return Ok(await quotes.QuoteAsync(product.Id, ToChoice(request), Settings, cancellationToken));
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Starts the free trial (the company is created now) or places a paid order (created when paid).</summary>
    [HttpPost("signup")]
    [EnableRateLimiting("public-signup")]
    public async Task<ActionResult<SignupResult>> Signup([FromBody] PublicSignupRequest request, CancellationToken cancellationToken)
    {
        if (!Settings.SignupEnabled) return NotFound();
        return await Guarded(async () =>
        {
            var result = await signups.CreateAsync(
                new SignupRequest(request.Business, request.StartTrial, request.Plan is null ? null : ToChoice(request.Plan), request.AcceptTerms,
                    request.FranchiseCode, request.FranchiseConsent),
                HttpContext.Connection.RemoteIpAddress?.ToString(), cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        });
    }

    /// <summary>
    /// Checks a franchise sign-up code: for a valid one, the franchisor's name and what they ask to see (shown with the
    /// consent box). Every invalid code gets the same answer; strictly rate-limited against guessing.
    /// </summary>
    [HttpPost("signup/franchise-code")]
    [EnableRateLimiting("public-code")]
    public async Task<ActionResult<FranchiseCodeCheck>> CheckFranchiseCode([FromBody] PublicFranchiseCodeRequest request, CancellationToken cancellationToken)
    {
        if (!Settings.SignupEnabled) return NotFound();
        try
        {
            return Ok((await franchiseCodes.CheckAsync(request.Code, cancellationToken)).Check);
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>Test servers only: completes a paid order without taking money.</summary>
    [HttpPost("signup/{orderId:guid}/test-payment")]
    [EnableRateLimiting("public-signup")]
    public async Task<ActionResult<SignupResult>> TestPayment(Guid orderId, [FromBody] PublicOrderTokenRequest request, CancellationToken cancellationToken)
    {
        if (!Settings.SignupEnabled) return NotFound();
        return await Guarded(async () => Ok(await signups.PayTestAsync(orderId, request.Token, cancellationToken)));
    }

    /// <summary>An order's state (for a page reload). The token travels in the body, never in the address.</summary>
    [HttpPost("signup/{orderId:guid}/status")]
    [EnableRateLimiting("public-read")]
    public async Task<ActionResult<SignupResult>> Status(Guid orderId, [FromBody] PublicOrderTokenRequest request, CancellationToken cancellationToken)
    {
        if (!Settings.SignupEnabled) return NotFound();
        return await Guarded(async () => Ok(await signups.StatusAsync(orderId, request.Token, cancellationToken)));
    }

    private async Task<ActionResult<SignupResult>> Guarded(Func<Task<ActionResult<SignupResult>>> action)
    {
        try { return await action(); }
        catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
        catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (ConflictException ex) { return Conflict(new { error = ex.Message }); }
    }

    private static PlanChoice ToChoice(PublicPlanChoiceDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.PlanCode)) throw new ValidationException("Choose a plan.");
        if (!Enum.TryParse<BillingInterval>(dto.Interval, ignoreCase: true, out var interval) || !Enum.IsDefined(interval))
        {
            throw new ValidationException("Choose monthly or yearly billing.");
        }
        var licences = dto.Licences ?? throw new ValidationException("Choose how many user licences you need.");
        return new PlanChoice(dto.PlanCode.Trim().ToLowerInvariant(), interval, new LicenceCounts(licences.Android, licences.Windows, licences.Both),
            dto.AddOns ?? new Dictionary<string, int>());
    }
}
