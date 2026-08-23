namespace CarSpaManagement.Api.Application.DTOs.Invoices;

public record PaymentDto(
	Guid Id,
	Guid InvoiceId,
	decimal Amount,
	string PaymentMethod,
	string? Reference,
	DateTime PaymentDate,
	DateTime CreatedAt);

public record RecordPaymentRequest(
	decimal Amount,
	string PaymentMethod,
	string? Reference = null,
	DateTime? PaymentDate = null);
