using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Infrastructure.Platform.Products;

internal static class ProductCatalogSeed
{
    // Adds missing definitions. Existing admin names, labels, types, ordering and active flags are preserved.
    internal static async Task<List<ProductSeatType>> EnsureDefinitionsAsync(PlatformDbContext catalog, PlatformProduct product,
        IReadOnlyList<SeatTypeDefinition> seats, IReadOnlyList<FeatureDefinition> features, CancellationToken ct)
    {
        var existingSeats = await catalog.ProductSeatTypes.Where(s => s.ProductId == product.Id).ToListAsync(ct);
        foreach (var seat in seats.Where(s => existingSeats.All(e => e.Code != s.Code)))
        {
            var row = new ProductSeatType { Id = Guid.NewGuid(), ProductId = product.Id, Code = seat.Code, Name = seat.Name, SortOrder = seat.SortOrder, DefaultSeat = seat.DefaultSeat, InvoiceLabel = seat.InvoiceLabel };
            catalog.ProductSeatTypes.Add(row);
            existingSeats.Add(row);
        }
        var existingFeatures = await catalog.ProductFeatures.Where(f => f.ProductId == product.Id).ToListAsync(ct);
        foreach (var feature in features.Where(f => existingFeatures.All(e => e.Key != f.Key)))
            catalog.ProductFeatures.Add(new ProductFeature
            {
                Id = Guid.NewGuid(), ProductId = product.Id, Key = feature.Key, Label = feature.Label,
                ValueType = feature.ValueType, SortOrder = feature.SortOrder
            });
        await catalog.SaveChangesAsync(ct);
        return existingSeats;
    }
}
