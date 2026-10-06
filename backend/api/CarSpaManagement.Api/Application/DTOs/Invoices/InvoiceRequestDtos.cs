using System.ComponentModel.DataAnnotations;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Application.DTOs.Invoices;

public record CreateInvoiceFromJobCardRequest(
	Guid JobCardId);

public record UpdateInvoiceRequest(
	decimal? Discount,
	string? Notes,
	InvoiceStatus? Status,
	bool? IsGstEnabled = null);

public record CancelInvoiceRequest(
	string? Reason = null);

public record UpdateInvoiceNumberRequest(
	string InvoiceNumber);

/// <summary>Draft values to calculate without saving (null = keep the stored value).</summary>
public record PreviewInvoiceRequest(
	decimal? Discount = null,
	bool? IsGstEnabled = null);

/// <summary>
/// Mandatory body for generation. ExpectedTotalAmount is required; generation is refused (409) if the authoritative
/// total differs, so the amount the user confirmed is exactly the amount issued.
/// </summary>
public record GenerateInvoiceRequest(
	[Required(ErrorMessage = "Expected total amount is required.")]
	decimal? ExpectedTotalAmount = null);
