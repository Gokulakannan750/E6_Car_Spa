using CarSpaManagement.Api.Application.Common;
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
	/// <summary>
	/// Summary rows for the tax groups of one invoice: "CGST @ 9% on Rs. X" / "SGST @ 9% on Rs. X" per rate,
	/// "GST @ 0% on Rs. X" for 0% lines, and plain "CGST" / "SGST" when the rate of a legacy line is unknown.
	/// </summary>
	public static IEnumerable<(string Label, decimal Amount)> TaxRows(IReadOnlyList<InvoiceCalculator.TaxGroup> groups)
	{
		var single = groups.Count == 1;
		foreach (var g in groups)
		{
			var on = single ? "" : $" on Rs. {g.Taxable:N2}";
			if (g.RatePercent is null)
			{
				yield return ("CGST" + on, g.Cgst);
				yield return ("SGST" + on, g.Sgst);
			}
			else if (g.RatePercent == 0m)
			{
				yield return ("GST @ 0%" + on, 0m);
			}
			else
			{
				var half = InvoiceCalculator.FormatRate(g.RatePercent.Value / 2m);
				yield return ($"CGST @ {half}" + on, g.Cgst);
				yield return ($"SGST @ {half}" + on, g.Sgst);
			}
		}
	}

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

		// Everything about the company comes from its own profile. A detail that has not been filled in is simply left
		// off the document; the generator never substitutes another company's name, address, contacts or logo.
		var businessName = businessProfile?.BusinessName?.Trim() ?? string.Empty;
		var addressLine1 = businessProfile?.AddressLine1?.Trim();
		var addressLine2 = businessProfile?.AddressLine2?.Trim();
		var city = businessProfile?.City?.Trim();
		var state = businessProfile?.State?.Trim();
		var postalCode = businessProfile?.PostalCode?.Trim();
		var cityStatePin = BuildCityStatePin(city, state, postalCode);
		var phone = businessProfile?.Phone?.Trim();
		var email = businessProfile?.Email?.Trim();
		var contactLine = BuildContactLine(phone, email);
		var gstin = businessProfile?.Gstin?.Trim();
		var tagline = string.IsNullOrWhiteSpace(businessProfile?.Tagline) ? null : businessProfile.Tagline.Trim();
		var termsLines = SplitLines(businessProfile?.TermsAndConditions);

		// Document Title
		var documentTitle = isDraft ? "DRAFT INVOICE" : isGst ? "TAX INVOICE" : "INVOICE";

		// Rate-wise tax rows from the stored invoice values (presentation only, no recalculation)
		var taxGroups = InvoiceCalculator.SummarizeStoredInvoice(invoice);

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

		var primaryColor = ResolveAccentColor(businessProfile?.BrandColor);
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
									if (!string.IsNullOrWhiteSpace(businessName))
										brandCol.Item().Text(businessName.ToUpperInvariant())
											.FontSize(16).Bold().FontColor(primaryColor);
									if (tagline != null)
										brandCol.Item().PaddingTop(1).Text(tagline)
											.FontSize(8).FontColor(mutedColor).SemiBold();
									if (!string.IsNullOrWhiteSpace(addressLine1))
										brandCol.Item().PaddingTop(2).Text(addressLine1).FontSize(8).FontColor(mutedColor);
									if (!string.IsNullOrWhiteSpace(addressLine2))
										brandCol.Item().Text(addressLine2).FontSize(8).FontColor(mutedColor);
									if (cityStatePin != null)
										brandCol.Item().Text(cityStatePin).FontSize(8).FontColor(mutedColor);
									if (contactLine != null)
										brandCol.Item().Text(contactLine).FontSize(8).FontColor(mutedColor);

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
							if (isGst) columns.ConstantColumn(40);
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
								header.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
									.AlignCenter().Text("GST").FontSize(8).Bold().FontColor(darkColor);
							}
							header.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
								.AlignCenter().Text("Qty").FontSize(8).Bold().FontColor(darkColor);
							header.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
								.AlignRight().Text("Rate").FontSize(8).Bold().FontColor(darkColor);
							header.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(5)
								.AlignRight().Text("Amount").FontSize(8).Bold().FontColor(darkColor);
						});

						var items = invoice.InvoiceItems?.Where(it => !it.IsDeleted).OrderBy(it => it.CreatedAt).ToList() ?? new List<InvoiceItem>();
						if (items.Count == 0)
						{
							var colSpan = isGst ? 7 : 5;
							table.Cell().ColumnSpan((uint)colSpan).Border(1).BorderColor(borderColor).Padding(12)
								.AlignCenter().Text("No service items recorded on this invoice.").Italic().FontColor(mutedColor);
						}
						else
						{
							for (int i = 0; i < items.Count; i++)
							{
								var itm = items[i];
								// Amount = Qty × Rate − line discount (before invoice discount and tax); the column sums to Subtotal.
								var lineAmount = InvoiceCalculator.Round(itm.UnitPrice * itm.Quantity) - itm.Discount;

								table.Cell().Border(1).BorderColor(borderColor).Padding(5)
									.AlignCenter().Text((i + 1).ToString()).FontSize(8).FontColor(mutedColor);
								table.Cell().Border(1).BorderColor(borderColor).Padding(5)
									.Text(itm.Description).FontSize(8.5f).SemiBold().FontColor(darkColor);
								if (isGst)
								{
									table.Cell().Border(1).BorderColor(borderColor).Padding(5)
										.AlignCenter().Text("998714").FontSize(8).FontColor(mutedColor);
									table.Cell().Border(1).BorderColor(borderColor).Padding(5)
										.AlignCenter().Text(itm.TaxRatePercent.HasValue ? InvoiceCalculator.FormatRate(itm.TaxRatePercent.Value) : "—").FontSize(8).FontColor(mutedColor);
								}
								table.Cell().Border(1).BorderColor(borderColor).Padding(5)
									.AlignCenter().Text(itm.Quantity.ToString()).FontSize(8.5f).FontColor(darkColor);
								table.Cell().Border(1).BorderColor(borderColor).Padding(5)
									.AlignRight().Text($"Rs. {itm.UnitPrice:N2}").FontSize(8.5f).FontColor(darkColor);
								table.Cell().Border(1).BorderColor(borderColor).Padding(5)
									.AlignRight().Text($"Rs. {lineAmount:N2}").FontSize(8.5f).Bold().FontColor(darkColor);
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

							if (termsLines.Count > 0)
							{
								notesCol.Item().Column(termsCol =>
								{
									termsCol.Item().Text("Terms & Conditions:").FontSize(8).Bold().FontColor(darkColor);
									for (var i = 0; i < termsLines.Count; i++)
									{
										var line = termsCol.Item();
										if (i == 0) line = line.PaddingTop(2);
										line.Text(termsLines[i]).FontSize(7.5f).FontColor(mutedColor);
									}
								});
							}
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

							// GST rows: taxable value, then CGST/SGST per rate actually charged on this invoice
							if (isGst)
							{
								totalsTable.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(4)
									.Text("Taxable Value").FontSize(8).FontColor(darkColor);
								totalsTable.Cell().Border(1).BorderColor(borderColor).Background(tableHeaderBg).Padding(4)
									.AlignRight().Text($"Rs. {invoice.TaxableAmount:N2}").FontSize(8.5f).Bold().FontColor(darkColor);

								foreach (var (label, amount) in TaxRows(taxGroups))
								{
									totalsTable.Cell().Border(1).BorderColor(borderColor).Padding(4)
										.Text(label).FontSize(8).FontColor(mutedColor);
									totalsTable.Cell().Border(1).BorderColor(borderColor).Padding(4)
										.AlignRight().Text($"Rs. {amount:N2}").FontSize(8.5f).Bold().FontColor(darkColor);
								}
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
							c.Item().Text(string.IsNullOrWhiteSpace(businessName) ? "Thank you!" : $"Thank you for choosing {businessName}!").FontSize(8.5f).Bold().FontColor(primaryColor);
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

	/// <summary>Neutral dark slate unless the company chose its own accent colour (#RRGGBB).</summary>
	public static string ResolveAccentColor(string? brandColor)
	{
		if (!string.IsNullOrWhiteSpace(brandColor) &&
			System.Text.RegularExpressions.Regex.IsMatch(brandColor.Trim(), "^#[0-9a-fA-F]{6}$"))
		{
			return brandColor.Trim().ToUpperInvariant();
		}

		return DefaultAccentColor;
	}

	public const string DefaultAccentColor = "#1E293B";

	private static string? BuildCityStatePin(string? city, string? state, string? postalCode)
	{
		var place = string.Join(", ", new[] { city, state }.Where(part => !string.IsNullOrWhiteSpace(part)));
		if (!string.IsNullOrWhiteSpace(postalCode))
		{
			place = place.Length > 0 ? $"{place} - {postalCode}" : postalCode;
		}

		return place.Length > 0 ? place : null;
	}

	private static string? BuildContactLine(string? phone, string? email)
	{
		var parts = new List<string>();
		if (!string.IsNullOrWhiteSpace(phone)) parts.Add($"Phone: {phone}");
		if (!string.IsNullOrWhiteSpace(email)) parts.Add($"Email: {email}");
		return parts.Count > 0 ? string.Join("  |  ", parts) : null;
	}

	private static List<string> SplitLines(string? text) =>
		string.IsNullOrWhiteSpace(text)
			? new List<string>()
			: text.Replace("\r\n", "\n").Split('\n').Select(l => l.Trim()).Where(l => l.Length > 0).ToList();

	private byte[]? ResolveLogoBytes(string? logoPath)
	{
		try
		{
			// No logo configured means no logo on the document; there is no built-in default.
			if (string.IsNullOrWhiteSpace(logoPath))
			{
				return null;
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
