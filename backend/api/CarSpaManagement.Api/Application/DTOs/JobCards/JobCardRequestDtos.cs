using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs.JobCards;

public record JobCardServiceItemRequest
{
 [Required] public Guid ServiceId { get; init; }

 [Required, Range(1, 999)]
 public int Quantity { get; init; } = 1;

 [Required, Range(0, 999999.99)]
 public decimal DiscountAmount { get; init; }
}

public record CreateJobCardRequest
{
 [Required] public Guid CustomerId { get; init; }

 [Required] public Guid VehicleId { get; init; }

 [MaxLength]
 public string? Notes { get; init; }

 [Required, MinLength(1)]
 public List<JobCardServiceItemRequest> Services { get; init; } = new();

 /// <summary>
 /// When true (default), tax/GST is calculated normally.
 /// When false, tax is treated as 0% — the job card is generated as a non-GST bill.
 /// </summary>
 public bool IsGstEnabled { get; init; } = true;
}

public record UpdateJobCardServicesRequest
{
 [Required, MinLength(0)]
 public List<JobCardServiceItemRequest> Services { get; init; } = new();

 [MaxLength]
 public string? Notes { get; init; }
}
