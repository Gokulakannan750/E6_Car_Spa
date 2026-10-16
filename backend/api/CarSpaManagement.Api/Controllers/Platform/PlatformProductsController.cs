using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Infrastructure.Platform;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Controllers.Platform;

public sealed record UpdateProductPublicListingRequest(string? PublicTagline, string? PublicDescription, string? LearnMoreUrl, string Reason);

[ApiController]
[Route("api/platform/products")]
[Authorize(Policy = PlatformPolicies.Any)]
public sealed class PlatformProductsController(PlatformDbContext catalog, PlatformAuditService audit) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var products = await catalog.Products.AsNoTracking().OrderBy(p => p.Key).ToListAsync(cancellationToken);
        var seats = await catalog.ProductSeatTypes.AsNoTracking().OrderBy(s => s.SortOrder).ToListAsync(cancellationToken);
        var features = await catalog.ProductFeatures.AsNoTracking().OrderBy(f => f.SortOrder).ToListAsync(cancellationToken);
        return Ok(products.Select(p => new
        {
            p.Key, p.Name, seatModel = p.SeatModel.ToString(), p.TrialPlanCode, p.DatabasePrefix, p.IsActive,
            publicTagline = p.PublicTagline, publicDescription = p.PublicDescription, learnMoreUrl = p.LearnMoreUrl,
            seatTypes = seats.Where(s => s.ProductId == p.Id).Select(s => new { s.Code, s.Name, s.SortOrder, s.IsActive, s.DefaultSeat }),
            features = features.Where(f => f.ProductId == p.Id).Select(f => new { f.Key, f.Label, type = f.ValueType.ToString(), f.SortOrder }),
            capabilities = p.Capabilities.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        }));
    }

    [HttpPut("{key}/public-listing")]
    [Authorize(Policy = PlatformPolicies.Owner)]
    public async Task<IActionResult> UpdatePublicListing(string key, [FromBody] UpdateProductPublicListingRequest request, CancellationToken cancellationToken)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Reason))
                throw new ValidationException("A reason is required.");

            var product = await catalog.Products.SingleOrDefaultAsync(p => p.Key == key, cancellationToken);
            if (product is null)
                return NotFound(new { error = "Product not found." });

            if (request.PublicTagline is { Length: > 140 })
                throw new ValidationException("Public tagline cannot exceed 140 characters.");

            if (request.PublicDescription is { Length: > 400 })
                throw new ValidationException("Public description cannot exceed 400 characters.");

            if (!string.IsNullOrWhiteSpace(request.LearnMoreUrl))
            {
                var url = request.LearnMoreUrl.Trim();
                if (url.Length > 300)
                    throw new ValidationException("Learn more URL cannot exceed 300 characters.");
                if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
                    throw new ValidationException("Learn more URL must be an https URL.");
            }

            var before = new
            {
                publicTagline = product.PublicTagline,
                publicDescription = product.PublicDescription,
                learnMoreUrl = product.LearnMoreUrl
            };

            product.PublicTagline = string.IsNullOrWhiteSpace(request.PublicTagline) ? null : request.PublicTagline.Trim();
            product.PublicDescription = string.IsNullOrWhiteSpace(request.PublicDescription) ? null : request.PublicDescription.Trim();
            product.LearnMoreUrl = string.IsNullOrWhiteSpace(request.LearnMoreUrl) ? null : request.LearnMoreUrl.Trim();

            await catalog.SaveChangesAsync(cancellationToken);

            var after = new
            {
                publicTagline = product.PublicTagline,
                publicDescription = product.PublicDescription,
                learnMoreUrl = product.LearnMoreUrl
            };

            await audit.RecordAsync("product.public_listing_updated", null, before, after, request.Reason, cancellationToken);

            var seats = await catalog.ProductSeatTypes.AsNoTracking().Where(s => s.ProductId == product.Id).OrderBy(s => s.SortOrder).ToListAsync(cancellationToken);
            var features = await catalog.ProductFeatures.AsNoTracking().Where(f => f.ProductId == product.Id).OrderBy(f => f.SortOrder).ToListAsync(cancellationToken);

            return Ok(new
            {
                product.Key, product.Name, seatModel = product.SeatModel.ToString(), product.TrialPlanCode, product.DatabasePrefix, product.IsActive,
                publicTagline = product.PublicTagline, publicDescription = product.PublicDescription, learnMoreUrl = product.LearnMoreUrl,
                seatTypes = seats.Select(s => new { s.Code, s.Name, s.SortOrder, s.IsActive, s.DefaultSeat }),
                features = features.Select(f => new { f.Key, f.Label, type = f.ValueType.ToString(), f.SortOrder }),
                capabilities = product.Capabilities.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
