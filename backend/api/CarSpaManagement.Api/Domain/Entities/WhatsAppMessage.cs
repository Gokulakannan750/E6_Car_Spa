using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Domain.Entities;

public class WhatsAppMessage : BaseEntity, IOrganizationOwned
{
	/// <summary>The company this row belongs to. Stamped automatically on save; never changes.</summary>
	public Guid OrganizationId { get; set; }

	public Guid InvoiceId { get; set; }
	public Invoice Invoice { get; set; } = null!;

	public Guid CustomerId { get; set; }
	public Customer Customer { get; set; } = null!;

	public WhatsAppMessageType MessageType { get; set; }

	[MaxLength(20)]
	public string RecipientPhone { get; set; } = string.Empty;

	public WhatsAppMessageStatus Status { get; set; } = WhatsAppMessageStatus.Pending;

	[MaxLength(100)]
	public string? MetaMessageId { get; set; }

	public DateTime? SentAtUtc { get; set; }
	public DateTime? FailedAtUtc { get; set; }

	[MaxLength(1000)]
	public string? ErrorMessage { get; set; }

	public int AttemptCount { get; set; } = 0;

	public DateTime? LastAttemptAtUtc { get; set; }

	public DateTime? NextAttemptAtUtc { get; set; }

	[MaxLength(2000)]
	public string? TemplateParametersJson { get; set; }
}
