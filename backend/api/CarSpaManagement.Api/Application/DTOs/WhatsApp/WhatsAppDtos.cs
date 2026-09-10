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
	DateTime? UpdatedAt,
	string HealthStatus = "NotConfigured",
	DateTime? LastCheckedAtUtc = null,
	DateTime? LastSuccessAtUtc = null,
	DateTime? LastFailureAtUtc = null,
	string? LastErrorMessage = null
);

public record WhatsAppHealthDto(
	string Status,
	DateTime? LastCheckedAtUtc,
	DateTime? LastSuccessAtUtc,
	DateTime? LastFailureAtUtc,
	string? LastErrorMessage,
	bool IsConfigured
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
	string? WhatsAppBusinessAccountId = null,
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

public record MetaWhatsAppTemplateButtonDto(
	string Type,
	string? Text = null,
	string? Url = null,
	string? PhoneNumber = null,
	IReadOnlyList<string>? Example = null
);

public record MetaWhatsAppTemplateComponentDto(
	string Type,
	string? Format = null,
	string? Text = null,
	IReadOnlyList<string>? Variables = null,
	IReadOnlyList<string>? Examples = null,
	IReadOnlyList<MetaWhatsAppTemplateButtonDto>? Buttons = null
);

public record MetaWhatsAppTemplateDto(
	string Id,
	string Name,
	string Status,
	string Category,
	string Language,
	IReadOnlyList<MetaWhatsAppTemplateComponentDto> Components
);

public record MetaWhatsAppTemplatesResponse(
	bool IsSuccess,
	string Message,
	IReadOnlyList<MetaWhatsAppTemplateDto> Templates,
	int TotalCount,
	string? Details = null
);

public record SendTestWhatsAppMessageRequest(
	string TemplateName,
	string LanguageCode,
	string RecipientPhoneNumber,
	IReadOnlyList<string>? Parameters = null
);

public record SendTestWhatsAppMessageResponse(
	bool IsSuccess,
	string Message,
	string? MessageId = null,
	string? Details = null
);
