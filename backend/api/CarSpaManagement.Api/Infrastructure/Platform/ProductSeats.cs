using System.Text.Json;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Infrastructure.Platform;

public sealed record SeatDto(string Code, string Name, int Quantity, long PriceMinor);

/// <summary>Seat validation and explicit persistence; legacy app counts are only an input/output adapter.</summary>
public static class ProductSeats
{
    public static IReadOnlyList<SeatDto> OrderSnapshot(SignupOrder order) => order.SeatsQuoteJson is null
        ? order.Seats.Select(s => new SeatDto(s.SeatType!.Code, s.SeatType.Name, s.Quantity, 0)).ToList()
        : JsonSerializer.Deserialize<List<SeatDto>>(order.SeatsQuoteJson) ?? [];

    public static IReadOnlyDictionary<string, int> Of(Subscription subscription) =>
        subscription.Seats.ToDictionary(s => s.SeatType!.Code, s => s.Quantity);
    public static IReadOnlyDictionary<string, int> Of(SignupOrder order) =>
        order.Seats.ToDictionary(s => s.SeatType!.Code, s => s.Quantity);
    public static LicenceCounts LicenceView(IReadOnlyDictionary<string, int> seats) =>
        new(seats.GetValueOrDefault("android"), seats.GetValueOrDefault("windows"), seats.GetValueOrDefault("both"));
    public static IReadOnlyDictionary<string, int> Legacy(LicenceCounts counts) =>
        new Dictionary<string, int> { ["android"] = counts.Android, ["windows"] = counts.Windows, ["both"] = counts.Both };

    public static Dictionary<string, int> Validate(PlatformProduct product, PlanVersion version,
        IReadOnlyList<ProductSeatType> types, IReadOnlyDictionary<string, int>? seats, LicenceCounts? legacy = null,
        int? defaultQuantity = null)
    {
        if (product.SeatModel == SeatModel.None)
        {
            if (seats?.Any(s => s.Value != 0) == true)
                throw new ValidationException("This product does not sell seats.");
            return [];
        }
        if (product.SeatModel == SeatModel.Counted && types.Count != 1)
            throw new ValidationException("A counted product must define one seat type.");
        seats ??= product.SeatModel == SeatModel.PerType && legacy is not null ? Legacy(legacy.Value) : null;
        if (seats is null)
        {
            var defaults = types.Where(t => t.DefaultSeat && t.IsActive).ToList();
            if (product.SeatModel == SeatModel.PerType && defaults.Count != 1)
                throw new ValidationException("Choose explicit seats: this product must have exactly one active default seat type.");
            var defaultType = product.SeatModel == SeatModel.PerType ? defaults[0] : types[0];
            seats = new Dictionary<string, int> { [defaultType.Code] = defaultQuantity ?? Math.Max(1, version.IncludedSeats) };
        }
        // Preserve Car Spa's existing validation messages for the compatibility request shape.
        if (product.SeatModel == SeatModel.PerType && legacy is not null && seats.SequenceEqual(Legacy(legacy.Value)))
            if (legacy.Value.Problem(version.IncludedSeats) is { } problem) throw new ValidationException(problem);
        foreach (var (code, quantity) in seats)
        {
            if (!types.Any(t => t.Code == code)) throw new ValidationException($"Unknown seat type '{code}'.");
            if (quantity is < 0 or > 500) throw new ValidationException($"Seat '{code}' must be between 0 and 500.");
        }
        if (seats.Values.Sum() < Math.Max(1, version.IncludedSeats))
            throw new ValidationException($"At least {Math.Max(1, version.IncludedSeats)} seats are needed.");
        foreach (var code in seats.Where(s => s.Value > 0).Select(s => s.Key))
            if (!version.SeatPrices.Any(p => p.SeatType?.Code == code))
                throw new ValidationException($"The plan has no price for seat '{code}'.");
        return types.ToDictionary(t => t.Code, t => seats.GetValueOrDefault(t.Code));
    }

    public static async Task SetAsync(PlatformDbContext catalog, Subscription subscription, Guid productId,
        IReadOnlyDictionary<string, int>? seats, LicenceCounts? legacy, CancellationToken ct, int? defaultQuantity = null)
    {
        var product = await catalog.Products.SingleAsync(p => p.Id == productId, ct);
        var version = await catalog.PlanVersions.Include(v => v.Plan).Include(v => v.SeatPrices).ThenInclude(p => p.SeatType)
            .SingleAsync(v => v.Id == subscription.PlanVersionId, ct);
        if (version.Plan!.ProductId != productId) throw new ValidationException("The plan belongs to another product.");
        var types = await catalog.ProductSeatTypes.Where(t => t.ProductId == productId).ToListAsync(ct);
        if (catalog.Entry(subscription).State != EntityState.Detached)
            await catalog.Entry(subscription).Collection(s => s.Seats).LoadAsync(ct);
        var quantities = Validate(product, version, types, seats, legacy, defaultQuantity);
        foreach (var row in subscription.Seats.Where(s => !quantities.ContainsKey(s.SeatType!.Code)).ToList())
        {
            subscription.Seats.Remove(row);
            catalog.SubscriptionSeats.Remove(row);
        }
        foreach (var type in types.Where(t => quantities.ContainsKey(t.Code)))
        {
            var row = subscription.Seats.SingleOrDefault(s => s.SeatTypeId == type.Id);
            if (row is null)
            {
                row = new SubscriptionSeat { Id = Guid.NewGuid(), SubscriptionId = subscription.Id, SeatTypeId = type.Id, SeatType = type };
                subscription.Seats.Add(row);
            }
            row.Quantity = quantities[type.Code];
        }
    }

    public static void SetOrder(SignupOrder order, IReadOnlyDictionary<string, int> seats, IReadOnlyList<ProductSeatType> types)
    {
        foreach (var (code, quantity) in seats)
        {
            var type = types.Single(t => t.Code == code);
            var row = order.Seats.SingleOrDefault(s => s.SeatTypeId == type.Id);
            if (row is null)
            {
                row = new SignupOrderSeat { Id = Guid.NewGuid(), SignupOrderId = order.Id, SeatTypeId = type.Id, SeatType = type };
                order.Seats.Add(row);
            }
            row.Quantity = quantity;
        }
    }

    public static IReadOnlyList<SeatDto> Describe(PlanVersion version, IReadOnlyDictionary<string, int>? quantities = null) =>
        version.SeatPrices.OrderBy(p => p.SeatType!.SortOrder).Select(p =>
            new SeatDto(p.SeatType!.Code, p.SeatType.Name, quantities?.GetValueOrDefault(p.SeatType.Code) ?? 0, p.PriceMinor)).ToList();

    public static string InvoiceLabel(ProductSeatType type) =>
        string.IsNullOrWhiteSpace(type.InvoiceLabel) ? $"{type.Name} seat" : type.InvoiceLabel;
}
