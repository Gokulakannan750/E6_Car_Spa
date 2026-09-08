using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using Microsoft.AspNetCore.Hosting;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CarSpaManagement.Api.Application.Services;

public class InvoicePdfGenerator : IInvoicePdfGenerator
{
	private readonly IWebHostEnvironment? _environment;

	static InvoicePdfGenerator()
	{
		QuestPDF.Settings.License = LicenseType.Community;
	}

	public InvoicePdfGenerator(IWebHostEnvironment? environment = null)
	{
		_environment = environment;
	}

	public byte[] GenerateInvoicePdf(Invoice invoice, BusinessProfile? businessProfile = null)
	{
		ArgumentNullException.ThrowIfNull(invoice);

		var isDraft = invoice.Status == InvoiceStatus.Draft;
		var isGst = invoice.IsGstEnabled;

		// Authoritative Business Profile Details with graceful fallbacks
		var businessName = string.IsNullOrWhiteSpace(businessProfile?.BusinessName) ? "E6 Car Spa" : businessProfile.BusinessName.Trim();
		var addressLine1 = string.IsNullOrWhiteSpace(businessProfile?.AddressLine1) ? "36, Geetha Nagar Main Road" : businessProfile.AddressLine1.Trim();
		var addressLine2 = string.IsNullOrWhiteSpace(businessProfile?.AddressLine2) ? "Behind Sakthi Mahal, Perundurai Road" : businessProfile.AddressLine2.Trim();
		var city = string.IsNullOrWhiteSpace(businessProfile?.City) ? "Erode" : businessProfile.City.Trim();
		var state = string.IsNullOrWhiteSpace(businessProfile?.State) ? "Tamil Nadu" : businessProfile.State.Trim();
		var postalCode = string.IsNullOrWhiteSpace(businessProfile?.PostalCode) ? "638011" : businessProfile.PostalCode.Trim();
		var cityStatePin = $"{city}, {state} - {postalCode}";
		var phone = string.IsNullOrWhiteSpace(businessProfile?.Phone) ? "9578749449" : businessProfile.Phone.Trim();
		var email = string.IsNullOrWhiteSpace(businessProfile?.Email) ? "e6carspaerd@gmail.com" : businessProfile.Email.Trim();
		var gstin = businessProfile?.Gstin?.Trim();

		// Document Title
		var documentTitle = isDraft ? "DRAFT INVOICE" : isGst ? "TAX INVOICE" : "INVOICE";

		// Authoritative calculations from the Invoice entity (presentation only, no recalculation)
		var cgstAmount = isGst ? invoice.GstAmount / 2 : 0m;
		var sgstAmount = isGst ? invoice.GstAmount / 2 : 0m;

		// Resolve logo bytes safely if file exists on disk
		byte[]? logoBytes = ResolveLogoBytes(businessProfile?.LogoPath);

		// Customer & Vehicle presentation strings
		var customerName = invoice.Customer?.Name ?? "Customer";
		var customerPhone = invoice.Customer?.PhoneNumber ?? "—";
		var regNumber = !string.IsNullOrWhiteSpace(invoice.Vehicle?.RegistrationNumber)
			? invoice.Vehicle.RegistrationNumber.Trim()
			: "—";

		var vehicleParts = new List<string>();
		if (!string.IsNullOrWhiteSpace(invoice.Vehicle?.Make)) vehicleParts.Add(invoice.Vehicle.Make.Trim());
		if (!string.IsNullOrWhiteSpace(invoice.Vehicle?.Model)) vehicleParts.Add(invoice.Vehicle.Model.Trim());
		var vehicleModelStr = vehicleParts.Count > 0 ? string.Join(" ", vehicleParts) : "—";
		if (!string.IsNullOrWhiteSpace(invoice.Vehicle?.Variant)) vehicleModelStr += $" ({invoice.Vehicle.Variant.Trim()})";
		if (!string.IsNullOrWhiteSpace(invoice.Vehicle?.Color)) vehicleModelStr += $" - {invoice.Vehicle.Color.Trim()}";

		var primaryColor = "#A11A1A";
		var darkColor = "#0F172A";
		var mutedColor = "#475569";
		var borderColor = "#CBD5E1";
		var tableHeaderBg = "#F1F5F9";

		var doc = Document.Create(container =>
		{
			container.Page(page =>
			{
				page.Size(PageSizes.A4);
				page.Margin(28, Unit.Point);
				page.PageColor(Colors.White);
				page.DefaultTextStyle(x => x.FontSize(9).FontFamily("Arial", "Helvetica", "sans-serif").FontColor(darkColor));

				page.Header().Element(header =>
				{
					header.Column(col =>
					{
						col.Item().Row(row =>
						{
							// Left: Brand Logo & Details
							row.RelativeItem(7).Row(brandRow =>
							{
								if (logoBytes != null && logoBytes.Length > 0)
								{
									brandRow.ConstantItem(48).Height(48).PaddingRight(10).Image(logoBytes);
								}

								brandRow.RelativeItem().Column(brandCol =>
								{
									brandCol.Item().Text(businessName.ToUpperInvariant())
										.FontSize(16).Bold().FontColor(primaryColor);
									brandCol.Item().PaddingTop(1).Text("Premium Auto Detailing & Car Care Solutions")
										.FontSize(8).FontColor(mutedColor).SemiBold();
									if (!string.IsNullOrWhiteSpace(addressLine1))
										brandCol.Item().PaddingTop(2).Text(addressLine1).FontSize(8).FontColor(mutedColor);
									if (!string.IsNullOrWhiteSpace(addressLine2))
										brandCol.Item().Text(addressLine2).FontSize(8).FontColor(mutedColor);
									brandCol.Item().Text(cityStatePin).FontSize(8).FontColor(mutedColor);
									brandCol.Item().Text($"Phone: {phone}  |  Email: {email}").FontSize(8).FontColor(mutedColor);

									if (isGst && !string.IsNullOrWhiteSpace(gstin))
									{
										brandCol.Item().PaddingTop(2).Text($"GSTIN: {gstin}").FontSize(8).Bold().FontColor(darkColor);
									}
								});
							});

							// Right: Document Title, Number, Date, Job Card
							row.RelativeItem(5).Column(metaCol =>
							{
								metaCol.Item().AlignRight().Text(documentTitle)
									.FontSize(18).Bold().FontColor(primaryColor);

								metaCol.Item().PaddingTop(4).AlignRight().Text(text =>
								{
									text.Span("Invoice No: ").FontSize(9).SemiBold().FontColor(darkColor);
									text.Span(invoice.InvoiceNumber ?? (isDraft ? "DRAFT" : "—")).FontSize(9).Bold().FontColor(darkColor);
								});

								metaCol.Item().AlignRight().Text($"Date: {invoice.InvoiceDate:dd-MM-yyyy}")
									.FontSize(8.5f).FontColor(mutedColor);

								if (!string.IsNullOrWhiteSpace(invoice.JobCard?.JobCardNumber))
								{
									metaCol.Item().AlignRight().Text(text =>
									{
										text.Span("Job Card: ").FontSize(8.5f).FontColor(mutedColor);
										text.Span(invoice.JobCard.JobCardNumber).FontSize(8.5f).SemiBold().FontColor(darkColor);
									});
								}
							});
						});

						// Red accent line divider
						col.Item().PaddingTop(8).PaddingBottom(10).LineHorizontal(2).LineColor(primaryColor);
					});
				});

				page.Content().Column(col =>
				{
					// Bill To & Vehicle Details Grid
					col.Item().Table(table =>
					{
						table.ColumnsDefinition(columns =>
						{
							columns.ConstantColumn(100);
							columns.RelativeColumn(1);
							columns.ConstantColumn(110);
							columns.RelativeColumn(1);
						});

						// Row 1: Bill To & Vehicle Reg No
						table.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
							.Text("BILL TO").FontSize(8).Bold().FontColor(darkColor);
						table.Cell().Border(1).BorderColor(borderColor).Padding(5)
							.Text(customerName).FontSize(9).Bold().FontColor(darkColor);
						table.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
							.Text("VEHICLE REG NO").FontSize(8).Bold().FontColor(darkColor);
						table.Cell().Border(1).BorderColor(borderColor).Padding(5)
							.Text(regNumber).FontSize(9).Bold().FontColor(darkColor);

						// Row 2: Phone & Vehicle Model
						table.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
							.Text("PHONE").FontSize(8).Bold().FontColor(darkColor);
						table.Cell().Border(1).BorderColor(borderColor).Padding(5)
							.Text(customerPhone).FontSize(8.5f).FontColor(darkColor);
						table.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
							.Text("VEHICLE MODEL").FontSize(8).Bold().FontColor(darkColor);
						table.Cell().Border(1).BorderColor(borderColor).Padding(5)
							.Text(vehicleModelStr).FontSize(8.5f).FontColor(darkColor);
					});

					col.Item().PaddingVertical(10);

					// Itemised Services Table
					col.Item().Table(table =>
					{
						table.ColumnsDefinition(columns =>
						{
							columns.ConstantColumn(24);
							columns.RelativeColumn(6);
							if (isGst) columns.ConstantColumn(65);
							columns.ConstantColumn(35);
							columns.ConstantColumn(75);
							columns.ConstantColumn(85);
						});

						table.Header(header =>
						{
							header.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
								.AlignCenter().Text("#").FontSize(8).Bold().FontColor(darkColor);
							header.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
								.Text("Description").FontSize(8).Bold().FontColor(darkColor);
							if (isGst)
							{
								header.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
									.AlignCenter().Text("HSN/SAC").FontSize(8).Bold().FontColor(darkColor);
							}
							header.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
								.AlignCenter().Text("Qty").FontSize(8).Bold().FontColor(darkColor);
							header.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
								.AlignRight().Text("Rate").FontSize(8).Bold().FontColor(darkColor);
							header.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
								.AlignRight().Text("Amount").FontSize(8).Bold().FontColor(darkColor);
						});

						var items = invoice.InvoiceItems?.ToList() ?? new List<InvoiceItem>();
						if (items.Count == 0)
						{
							var colSpan = isGst ? 6 : 5;
							table.Cell().ColumnSpan((uint)colSpan).Border(1).BorderColor(borderColor).Padding(12)
								.AlignCenter().Text("No service items recorded on this invoice.").Italic().FontColor(mutedColor);
						}
						else
						{
							for (int i = 0; i < items.Count; i++)
							{
								var itm = items[i];
								var lineTotal = itm.TotalAmount > 0 ? itm.TotalAmount : itm.UnitPrice * itm.Quantity;

								table.Cell().Border(1).BorderColor(borderColor).Padding(5)
									.AlignCenter().Text((i + 1).ToString()).FontSize(8).FontColor(mutedColor);
								table.Cell().Border(1).BorderColor(borderColor).Padding(5)
									.Text(itm.Description).FontSize(8.5f).SemiBold().FontColor(darkColor);
								if (isGst)
								{
									table.Cell().Border(1).BorderColor(borderColor).Padding(5)
										.AlignCenter().Text("998714").FontSize(8).FontColor(mutedColor);
								}
								table.Cell().Border(1).BorderColor(borderColor).Padding(5)
									.AlignCenter().Text(itm.Quantity.ToString()).FontSize(8.5f).FontColor(darkColor);
								table.Cell().Border(1).BorderColor(borderColor).Padding(5)
									.AlignRight().Text($"Rs. {itm.UnitPrice:N2}").FontSize(8.5f).FontColor(darkColor);
								table.Cell().Border(1).BorderColor(borderColor).Padding(5)
									.AlignRight().Text($"Rs. {lineTotal:N2}").FontSize(8.5f).Bold().FontColor(darkColor);
							}
						}
					});

					col.Item().PaddingVertical(10);

					// Financial Summary & Notes
					col.Item().Row(summaryRow =>
					{
						// Left: Notes and Terms
						summaryRow.RelativeItem(6).Column(notesCol =>
						{
							if (!string.IsNullOrWhiteSpace(invoice.Notes))
							{
								notesCol.Item().Border(1).BorderColor(borderColor).Background("#F8FAFC").Padding(6)
									.Column(c =>
									{
										c.Item().Text("Invoice Notes:").FontSize(7.5f).Bold().FontColor(mutedColor);
										c.Item().PaddingTop(2).Text(invoice.Notes).FontSize(8).FontColor(darkColor);
									});
								notesCol.Item().PaddingVertical(4);
							}

							notesCol.Item().Column(termsCol =>
							{
								termsCol.Item().Text("Terms & Conditions:").FontSize(8).Bold().FontColor(darkColor);
								termsCol.Item().PaddingTop(2).Text("1. Payment is due upon completion of vehicle detailing services.").FontSize(7.5f).FontColor(mutedColor);
								termsCol.Item().Text("2. Goods/services once provided are non-refundable.").FontSize(7.5f).FontColor(mutedColor);
								termsCol.Item().Text("3. Please inspect your vehicle thoroughly prior to delivery handover.").FontSize(7.5f).FontColor(mutedColor);
							});
						});

						summaryRow.ConstantItem(16);

						// Right: Authoritative Totals Breakdown Table
						summaryRow.RelativeItem(5).Table(totalsTable =>
						{
							totalsTable.ColumnsDefinition(cols =>
							{
								cols.RelativeColumn(1);
								cols.RelativeColumn(1);
							});

							// Subtotal
							totalsTable.Cell().Border(1).BorderColor(borderColor).Padding(4)
								.Text("Subtotal").FontSize(8).FontColor(mutedColor);
							totalsTable.Cell().Border(1).BorderColor(borderColor).Padding(4)
								.AlignRight().Text($"Rs. {invoice.Subtotal:N2}").FontSize(8.5f).Bold().FontColor(darkColor);

							// Discount (if any)
							if (invoice.Discount > 0)
							{
								totalsTable.Cell().Border(1).BorderColor(borderColor).Background("#ECFDF5").Padding(4)
									.Text("Discount Applied").FontSize(8).FontColor("#065F46");
								totalsTable.Cell().Border(1).BorderColor(borderColor).Background("#ECFDF5").Padding(4)
									.AlignRight().Text($"- Rs. {invoice.Discount:N2}").FontSize(8.5f).Bold().FontColor("#065F46");
							}

							// GST Rows (Taxable, CGST 9%, SGST 9%)
							if (isGst)
							{
								totalsTable.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(4)
									.Text("Taxable Value").FontSize(8).FontColor(darkColor);
								totalsTable.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(4)
									.AlignRight().Text($"Rs. {invoice.TaxableAmount:N2}").FontSize(8.5f).Bold().FontColor(darkColor);

								totalsTable.Cell().Border(1).BorderColor(borderColor).Padding(4)
									.Text("CGST (9%)").FontSize(8).FontColor(mutedColor);
								totalsTable.Cell().Border(1).BorderColor(borderColor).Padding(4)
									.AlignRight().Text($"Rs. {cgstAmount:N2}").FontSize(8.5f).Bold().FontColor(darkColor);

								totalsTable.Cell().Border(1).BorderColor(borderColor).Padding(4)
									.Text("SGST (9%)").FontSize(8).FontColor(mutedColor);
								totalsTable.Cell().Border(1).BorderColor(borderColor).Padding(4)
									.AlignRight().Text($"Rs. {sgstAmount:N2}").FontSize(8.5f).Bold().FontColor(darkColor);
							}

							// Grand Total
							totalsTable.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
								.Text("Grand Total").FontSize(9).Bold().FontColor(darkColor);
							totalsTable.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
								.AlignRight().Text($"Rs. {invoice.TotalAmount:N2}").FontSize(9.5f).Bold().FontColor(primaryColor);

							// Amount Paid
							totalsTable.Cell().Border(1).BorderColor(borderColor).Padding(4)
								.Text("Amount Paid").FontSize(8).FontColor(mutedColor);
							totalsTable.Cell().Border(1).BorderColor(borderColor).Padding(4)
								.AlignRight().Text($"Rs. {invoice.PaidAmount:N2}").FontSize(8.5f).Bold().FontColor(darkColor);

							// Balance Due
							totalsTable.Cell().Border(1).BorderColor(borderColor).Background("#F8FAFC").Padding(5)
								.Text("Balance Due").FontSize(9).Bold().FontColor(darkColor);
							totalsTable.Cell().Border(1).BorderColor(borderColor).Background("#F8FAFC").Padding(5)
								.AlignRight().Text($"Rs. {invoice.BalanceAmount:N2}").FontSize(9.5f).Bold().FontColor(darkColor);
						});
					});
				});

				page.Footer().Column(foot =>
				{
					foot.Item().LineHorizontal(1).LineColor(borderColor);
					foot.Item().PaddingTop(6).Row(r =>
					{
						r.RelativeItem().Column(c =>
						{
							c.Item().Text($"Thank you for choosing {businessName}!").FontSize(8.5f).Bold().FontColor(primaryColor);
							c.Item().Text("This is a computer generated invoice. No physical signature is required.").FontSize(7).FontColor(mutedColor);
						});
					});
				});
			});
		});

		var pdfBytes = doc.GeneratePdf();

		// Validate PDF size and header
		if (pdfBytes == null || pdfBytes.Length == 0)
		{
			throw new InvalidOperationException("Generated invoice PDF is empty.");
		}

		return pdfBytes;
	}

	private byte[]? ResolveLogoBytes(string? logoPath)
	{
		try
		{
			if (string.IsNullOrWhiteSpace(logoPath))
			{
				logoPath = "/uploads/logos/e6-logo.png";
			}

			var cleanPath = logoPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);

			// Check environment WebRootPath
			if (_environment?.WebRootPath != null)
			{
				var fullPath = Path.Combine(_environment.WebRootPath, cleanPath);
				if (File.Exists(fullPath))
				{
					return File.ReadAllBytes(fullPath);
				}
			}

			// Check Directory.GetCurrentDirectory() / wwwroot
			var fallbackDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", cleanPath);
			if (File.Exists(fallbackDir))
			{
				return File.ReadAllBytes(fallbackDir);
			}
		}
		catch
		{
			// Missing logo should degrade gracefully rather than fail PDF generation
		}

		return null;
	}
}
