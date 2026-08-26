using CarSpaManagement.Api.Domain.Common;
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

	public string? AccessTokenEncrypted { get; set; }

	public bool InvoiceNotificationsEnabled { get; set; } = true;

	public bool PaymentCompletedNotificationsEnabled { get; set; } = true;

	[MaxLength(100)]
	public string InvoiceTemplateName { get; set; } = "e6_carspa_invoice_generated";

	[MaxLength(20)]
	public string InvoiceTemplateLanguage { get; set; } = "en_US";

	[MaxLength(100)]
	public string PaymentCompletedTemplateName { get; set; } = "e6_carspa_payment_completed";

	[MaxLength(20)]
	public string PaymentCompletedTemplateLanguage { get; set; } = "en_US";
}
