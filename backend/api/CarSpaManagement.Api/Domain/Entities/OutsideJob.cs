using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Domain.Entities;

public class OutsideJob : BaseEntity
{
    public Guid JobCardId { get; set; }
    public JobCard JobCard { get; set; } = null!;

    public Guid VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;

    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public Guid VendorId { get; set; }
    public Vendor Vendor { get; set; } = null!;

    public Guid? ServiceId { get; set; }
    public Service? Service { get; set; }

    [Required]
    [MaxLength(150)]
    public string ServiceName { get; set; } = string.Empty;

    public OutsideJobStatus Status { get; set; } = OutsideJobStatus.Outside;

    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    public DateTime ExpectedReturnAt { get; set; }

    public DateTime? ReturnedAt { get; set; }

    public Guid? SentByUserId { get; set; }

    [MaxLength(100)]
    public string? SentByUserName { get; set; }

    public Guid? ReturnedByUserId { get; set; }

    [MaxLength(100)]
    public string? ReturnedByUserName { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? VendorCost { get; set; }

    [MaxLength(1000)]
    public string? Notes { get; set; }

    [MaxLength(1000)]
    public string? ReturnNotes { get; set; }

    [MaxLength(500)]
    public string? CancellationReason { get; set; }
}
