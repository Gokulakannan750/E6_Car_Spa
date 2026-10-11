using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Domain.Entities;

public class JobCard : BaseEntity, IOrganizationOwned
{
    /// <summary>The company this row belongs to. Stamped automatically on save; never changes.</summary>
    public Guid OrganizationId { get; set; }

    [MaxLength(30)]
    public string JobCardNumber { get; set; } = string.Empty;

    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public Guid VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;

    public JobCardStatus Status { get; set; } = JobCardStatus.Draft;

    [MaxLength]
    public string? Notes { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal Subtotal { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal TaxAmount { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal DiscountAmount { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalAmount { get; set; }

    public List<JobCardService> JobCardServices { get; set; } = new();
    public List<OutsideJob> OutsideJobs { get; set; } = new();
}
