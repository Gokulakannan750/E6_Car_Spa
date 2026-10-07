using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Domain.Entities;

public class WhatsAppConfiguration : BaseEntity
{
	public int SingletonKey { get; set; } = 1;

	public bool IsEnabled { get; set; } = false;

	[MaxLength(50)]
	public string PhoneNumberId { get; set; } = string.Empty;

	[MaxLength(50)]
	public string BusinessAccountId { get; set; } = string.Empty;

	[MaxLength(20)]
	public string GraphApiVersion { get; set; } = "v25.0";

	/// <summary>Meta app ID, used to upload the sample document Meta requires when creating a document-header template.</summary>
	[MaxLength(50)]
	public string? MetaAppId { get; set; }

	public string? AccessTokenEncrypted { get; set; }

	public bool InvoiceNotificationsEnabled { get; set; } = true;

	public bool PaymentCompletedNotificationsEnabled { get; set; } = true;

	/// <summary>
	/// When true, automatic messages go only to customers whose WhatsApp consent is recorded. Off by default so
	/// existing behaviour is unchanged until consent has been collected.
	/// </summary>
	public bool RequireCustomerConsent { get; set; } = false;

	[MaxLength(100)]
	public string InvoiceTemplateName { get; set; } = "e6_carspa_invoice_generated";

	[MaxLength(20)]
	public string InvoiceTemplateLanguage { get; set; } = "en";

	[MaxLength(100)]
	public string PaymentCompletedTemplateName { get; set; } = "e6_carspa_payment_completed";

	[MaxLength(20)]
	public string PaymentCompletedTemplateLanguage { get; set; } = "en_US";

	public WhatsAppHealthStatus HealthStatus { get; set; } = WhatsAppHealthStatus.NotConfigured;

	public DateTime? LastCheckedAtUtc { get; set; }

	public DateTime? LastSuccessAtUtc { get; set; }

	public DateTime? LastFailureAtUtc { get; set; }

	[MaxLength(500)]
	public string? LastErrorMessage { get; set; }
}
