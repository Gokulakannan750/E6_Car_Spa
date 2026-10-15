using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Domain.Platform;

public enum SeatModel { None = 0, Counted = 1, PerType = 2 }

public class ProductSeatType
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    [Required, MaxLength(30)] public string Code { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class SubscriptionSeat
{
    public Guid Id { get; set; }
    public Guid SubscriptionId { get; set; }
    public Guid SeatTypeId { get; set; }
    public ProductSeatType? SeatType { get; set; }
    public int Quantity { get; set; }
}

public class PlanVersionSeatPrice
{
    public Guid Id { get; set; }
    public Guid PlanVersionId { get; set; }
    public Guid SeatTypeId { get; set; }
    public ProductSeatType? SeatType { get; set; }
    public long PriceMinor { get; set; }
}

public class SignupOrderSeat
{
    public Guid Id { get; set; }
    public Guid SignupOrderId { get; set; }
    public Guid SeatTypeId { get; set; }
    public ProductSeatType? SeatType { get; set; }
    public int Quantity { get; set; }
}

public class ProductFeature
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    [Required, MaxLength(60)] public string Key { get; set; } = string.Empty;
    public EntitlementValueType ValueType { get; set; }
    [Required, MaxLength(100)] public string Label { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}
