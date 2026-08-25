using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Domain.Entities;

public class InvoicePublicLink : BaseEntity
{
    public Guid InvoiceId { get; set; }
    public Invoice Invoice { get; set; } = null!;

    [MaxLength(64)]
    public string TokenHash { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public Guid? CreatedByUserId { get; set; }

    public DateTime? LastAccessedAtUtc { get; set; }

    public int AccessCount { get; set; } = 0;

    public bool IsRevoked { get; set; } = false;

    public DateTime? RevokedAtUtc { get; set; }

    public Guid? RevokedByUserId { get; set; }

    public DateTime? ExpiresAtUtc { get; set; }
}
