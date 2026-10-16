using CarSpaManagement.Api.Infrastructure.Platform;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Controllers.Platform;

[ApiController]
[Route("api/platform/products")]
[Authorize(Policy = PlatformPolicies.Any)]
public sealed class PlatformProductsController(PlatformDbContext catalog) : ControllerBase
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
            seatTypes = seats.Where(s => s.ProductId == p.Id).Select(s => new { s.Code, s.Name, s.SortOrder, s.IsActive, s.DefaultSeat }),
            features = features.Where(f => f.ProductId == p.Id).Select(f => new { f.Key, f.Label, type = f.ValueType.ToString(), f.SortOrder }),
            capabilities = p.Capabilities.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        }));
    }
}
