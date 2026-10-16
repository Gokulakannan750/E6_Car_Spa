using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Infrastructure.Platform.Products;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CarSpaManagement.Api.Controllers.Platform;

public sealed record PublicLicencesDto(int Android, int Windows, int Both);
public sealed record PublicPlanChoiceDto(string PlanCode, string Interval, PublicLicencesDto? Licences, Dictionary<string, int>? AddOns, Dictionary<string, int>? Seats = null);
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
    CatalogReader catalogReader,
    FranchiseSignupCodeRedemption franchiseCodes,
    PlatformSettingsService platformSettings,
    IOptions<PlatformOptions> options,
    ProductSelection products) : ControllerBase
{
    private PlatformOptions Settings => options.Value;

    [HttpGet("products")]
    [EnableRateLimiting("public-read")]
    public async Task<IActionResult> Products(CancellationToken cancellationToken)
    {
        if (!Settings.SignupEnabled) return NotFound();
        await provisioner.EnsureCatalogAsync(cancellationToken);
        var active = await catalog.Products.AsNoTracking().Where(p => p.IsActive).OrderBy(p => p.Key).ToListAsync(cancellationToken);
        var productIds = active.Select(p => p.Id).ToList();
        var now = DateTime.UtcNow;
        var plans = await catalog.Plans.AsNoTracking()
            .Include(p => p.Versions)
                .ThenInclude(v => v.SeatPrices)
                    .ThenInclude(sp => sp.SeatType)
            .Where(p => productIds.Contains(p.ProductId) && p.IsActive)
            .ToListAsync(cancellationToken);

        return Ok(active.Select(p => new
        {
            p.Key,
            p.Name,
            seatModel = p.SeatModel.ToString(),
            capabilities = p.Capabilities.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            publicTagline = p.PublicTagline,
            publicDescription = p.PublicDescription,
            learnMoreUrl = p.LearnMoreUrl,
            startingPrice = ComputeStartingPrice(p, plans.Where(plan => plan.ProductId == p.Id), now)
        }));
    }

    /// <summary>Plans, licence prices and add-ons on sale now, for the pricing page.</summary>
    [HttpGet("catalog")]
    [EnableRateLimiting("public-read")]
    public async Task<ActionResult<PublicCatalogDto>> Catalog(CancellationToken cancellationToken, [FromQuery] string? product = null)
    {
        if (!Settings.SignupEnabled) return NotFound();
        await provisioner.EnsureCatalogAsync(cancellationToken);
        var selected = await products.RequiredAsync(product, cancellationToken);
        if (!selected.IsActive) return NotFound(new { error = "Product not found." });
        return Ok(await catalogReader.ReadAsync(cancellationToken, selected.Key));
    }

    /// <summary>The price of a choice, worked out by the server (the website shows it before the customer pays).</summary>
    [HttpPost("signup/quote")]
    [EnableRateLimiting("public-read")]
    public async Task<ActionResult<PriceQuote>> Quote([FromBody] PublicPlanChoiceDto request, CancellationToken cancellationToken, [FromQuery] string? product = null)
    {
        if (!Settings.SignupEnabled) return NotFound();
        try
        {
            await provisioner.EnsureCatalogAsync(cancellationToken);
            var selectedProduct = await products.RequiredAsync(product, cancellationToken);
            if (!selectedProduct.IsActive) return NotFound(new { error = "Product not found." });
            return Ok(await quotes.QuoteAsync(selectedProduct.Id, ToChoice(request), Settings, cancellationToken));
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Starts the free trial (the company is created now) or places a paid order (created when paid).</summary>
    [HttpPost("signup")]
    [EnableRateLimiting("public-signup")]
    public async Task<ActionResult<SignupResult>> Signup([FromBody] PublicSignupRequest request, CancellationToken cancellationToken, [FromQuery] string? product = null)
    {
        if (!Settings.SignupEnabled) return NotFound();
        return await Guarded(async () =>
        {
            var result = await signups.CreateAsync(
                new SignupRequest(request.Business, request.StartTrial, request.Plan is null ? null : ToChoice(request.Plan), request.AcceptTerms,
                    request.FranchiseCode, request.FranchiseConsent),
                HttpContext.Connection.RemoteIpAddress?.ToString(), cancellationToken, products.RequiredKey(product));
            return StatusCode(StatusCodes.Status201Created, result);
        });
    }

    /// <summary>
    /// Checks a franchise sign-up code: for a valid one, the franchisor's name and what they ask to see (shown with the
    /// consent box). Every invalid code gets the same answer; strictly rate-limited against guessing.
    /// </summary>
    [HttpPost("signup/franchise-code")]
    [EnableRateLimiting("public-code")]
    public async Task<ActionResult<FranchiseCodeCheck>> CheckFranchiseCode([FromBody] PublicFranchiseCodeRequest request, CancellationToken cancellationToken, [FromQuery] string? product = null)
    {
        if (!Settings.SignupEnabled) return NotFound();
        try
        {
            var key = products.RequiredKey(product);
            var selected = await products.RequiredAsync(key, cancellationToken);
            if (!selected.IsActive || key != Settings.ProductKey || !selected.Capabilities.Split(',').Contains("franchise")) return NotFound();
            return Ok((await franchiseCodes.CheckAsync(request.Code, cancellationToken)).Check);
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>Test servers only: completes a paid order without taking money.</summary>
    [HttpPost("signup/{orderId:guid}/test-payment")]
    [EnableRateLimiting("public-signup")]
    public async Task<ActionResult<SignupResult>> TestPayment(Guid orderId, [FromBody] PublicOrderTokenRequest request, CancellationToken cancellationToken, [FromQuery] string? product = null)
    {
        if (!Settings.SignupEnabled) return NotFound();
        return await Guarded(async () => Ok(await signups.PayTestAsync(orderId, request.Token, cancellationToken, product is null ? null : products.RequiredKey(product))));
    }

    /// <summary>An order's state (for a page reload). The token travels in the body, never in the address.</summary>
    [HttpPost("signup/{orderId:guid}/status")]
    [EnableRateLimiting("public-read")]
    public async Task<ActionResult<SignupResult>> Status(Guid orderId, [FromBody] PublicOrderTokenRequest request, CancellationToken cancellationToken, [FromQuery] string? product = null)
    {
        if (!Settings.SignupEnabled) return NotFound();
        return await Guarded(async () => Ok(await signups.StatusAsync(orderId, request.Token, cancellationToken, product is null ? null : products.RequiredKey(product))));
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
        var licences = dto.Licences ?? new PublicLicencesDto(0, 0, 0);
        return new PlanChoice(dto.PlanCode.Trim().ToLowerInvariant(), interval, new LicenceCounts(licences.Android, licences.Windows, licences.Both),
            dto.AddOns ?? new Dictionary<string, int>(), dto.Seats);
    }

    private static object? ComputeStartingPrice(PlatformProduct product, IEnumerable<Plan> productPlans, DateTime now)
    {
        var candidatePrices = new List<(long amount, BillingInterval interval, string currency, bool perSeat)>();

        foreach (var plan in productPlans.Where(p => p.IsActive))
        {
            var activeVersions = plan.Versions
                .Where(v => v.EffectiveFrom <= now && (v.EffectiveTo == null || v.EffectiveTo > now))
                .GroupBy(v => v.Interval)
                .Select(g => g.OrderByDescending(v => v.Version).First());

            foreach (var v in activeVersions)
            {
                if (product.SeatModel == SeatModel.None)
                {
                    candidatePrices.Add((v.PriceMinor, v.Interval, v.Currency, false));
                }
                else
                {
                    var activeSeatPrices = v.SeatPrices
                        .Where(sp => sp.SeatType == null || sp.SeatType.IsActive)
                        .Select(sp => sp.PriceMinor)
                        .ToList();

                    if (activeSeatPrices.Count > 0)
                    {
                        candidatePrices.Add((activeSeatPrices.Min(), v.Interval, v.Currency, true));
                    }
                }
            }
        }

        if (candidatePrices.Count == 0) return null;

        var cheapest = candidatePrices.OrderBy(c => c.amount).First();
        return new
        {
            amountMinor = cheapest.amount,
            interval = cheapest.interval.ToString(),
            currency = cheapest.currency,
            perSeat = cheapest.perSeat
        };
    }
}
