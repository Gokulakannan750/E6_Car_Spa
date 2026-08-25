namespace CarSpaManagement.Api.Application.DTOs.WhatsApp;

public record WhatsAppConfigResponse(
	bool IsEnabled,
	string PhoneNumberId,
	string BusinessAccountId,
	string GraphApiVersion,
	bool HasAccessToken,
	bool InvoiceNotificationsEnabled,
	bool PaymentCompletedNotificationsEnabled,
	string InvoiceTemplateName,
	string InvoiceTemplateLanguage,
	string PaymentCompletedTemplateName,
	string PaymentCompletedTemplateLanguage,
	DateTime? UpdatedAt
);

public record UpdateWhatsAppConfigRequest
{
	public bool IsEnabled { get; init; }
	public string PhoneNumberId { get; init; } = string.Empty;
	public string BusinessAccountId { get; init; } = string.Empty;
	public string GraphApiVersion { get; init; } = "v25.0";
	public string? AccessToken { get; init; }
	public bool InvoiceNotificationsEnabled { get; init; } = true;
	public bool PaymentCompletedNotificationsEnabled { get; init; } = true;
	public string? InvoiceTemplateName { get; init; }
	public string? InvoiceTemplateLanguage { get; init; }
	public string? PaymentCompletedTemplateName { get; init; }
	public string? PaymentCompletedTemplateLanguage { get; init; }
}

public record TestWhatsAppConnectionRequest(
	string? PhoneNumberId = null,
	string? BusinessAccountId = null,
	string? GraphApiVersion = null,
	string? AccessToken = null
);

public record TestWhatsAppConnectionResponse(
	bool IsSuccess,
	string Message,
	string? Details = null
);

public record InvoiceWhatsAppStatusDto(
	string MessageType,
	string Status,
	string? MetaMessageId,
	DateTime? SentAtUtc,
	DateTime? FailedAtUtc,
	string? ErrorMessage,
	int AttemptCount
);
