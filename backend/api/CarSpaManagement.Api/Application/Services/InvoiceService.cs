using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;

namespace CarSpaManagement.Api.Application.Services;

public class InvoiceService : IInvoiceService
{
	private readonly AppDbContext _db;
	private readonly IAuditLogService _auditLogService;
	private readonly IConfiguration _configuration;
	private readonly IHttpContextAccessor _httpContextAccessor;
	private readonly IWhatsAppService _whatsAppService;
	private readonly IServiceScopeFactory _scopeFactory;

	public InvoiceService(
		AppDbContext db,
		IAuditLogService auditLogService,
		IConfiguration configuration,
		IHttpContextAccessor httpContextAccessor,
		IWhatsAppService whatsAppService,
		IServiceScopeFactory scopeFactory)
	{
		_db = db;
		_auditLogService = auditLogService;
		_configuration = configuration;
		_httpContextAccessor = httpContextAccessor;
		_whatsAppService = whatsAppService;
		_scopeFactory = scopeFactory;
	}

	public async Task<IReadOnlyList<InvoiceListDto>> GetAllAsync(int page, int pageSize, string? search = null, InvoiceStatus? status = null, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default)
	{
		var query = _db.Invoices
			.Include(i => i.Customer)
			.Include(i => i.Vehicle)
			.Include(i => i.JobCard)
			.AsQueryable();

		if (status.HasValue) query = query.Where(i => i.Status == status.Value);
		if (fromDate.HasValue) query = query.Where(i => i.InvoiceDate >= fromDate.Value);
		if (toDate.HasValue) query = query.Where(i => i.InvoiceDate <= toDate.Value.AddDays(1));

		if (!string.IsNullOrWhiteSpace(search))
		{
			search = search.Trim().ToLower();
			query = query.Where(i => (i.InvoiceNumber != null && i.InvoiceNumber.ToLower().Contains(search))
				|| (i.Customer.Name != null && i.Customer.Name.ToLower().Contains(search))
				|| (i.Vehicle.RegistrationNumber != null && i.Vehicle.RegistrationNumber.ToLower().Contains(search)));
		}

		return await query.OrderByDescending(i => i.CreatedAt)
			.Skip((page - 1) * pageSize)
			.Take(pageSize)
			.Select(i => ToListDto(i))
			.ToListAsync(cancellationToken);
	}

	public async Task<int> GetTotalCountAsync(string? search = null, InvoiceStatus? status = null, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default)
	{
		var query = _db.Invoices.AsQueryable();

		if (status.HasValue) query = query.Where(i => i.Status == status.Value);
		if (fromDate.HasValue) query = query.Where(i => i.InvoiceDate >= fromDate.Value);
		if (toDate.HasValue) query = query.Where(i => i.InvoiceDate <= toDate.Value.AddDays(1));

		if (!string.IsNullOrWhiteSpace(search))
		{
			search = search.Trim().ToLower();
			query = query.Where(i => (i.InvoiceNumber != null && i.InvoiceNumber.ToLower().Contains(search)));
		}

		return await query.CountAsync(cancellationToken);
	}

	public async Task<InvoiceDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
	{
		var invoice = await _db.Invoices
			.Include(i => i.Customer)
			.Include(i => i.Vehicle)
			.Include(i => i.JobCard)
			.Include(i => i.InvoiceItems)
			.Include(i => i.Payments)
			.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

		return invoice is null ? null : ToDto(invoice);
	}

	public async Task<InvoiceDto?> GetByNumberAsync(string invoiceNumber, CancellationToken cancellationToken = default)
	{
		var invoice = await _db.Invoices
			.Include(i => i.Customer)
			.Include(i => i.Vehicle)
			.Include(i => i.JobCard)
			.Include(i => i.InvoiceItems)
			.Include(i => i.Payments)
			.FirstOrDefaultAsync(i => i.InvoiceNumber == invoiceNumber, cancellationToken);

		return invoice is null ? null : ToDto(invoice);
	}

	public async Task<InvoiceDto> CreateFromJobCardAsync(CreateInvoiceFromJobCardRequest request, CancellationToken cancellationToken = default)
	{
		var jobCard = await _db.JobCards
			.Include(j => j.Customer)
			.Include(j => j.Vehicle)
			.Include(j => j.JobCardServices)
			.FirstOrDefaultAsync(j => j.Id == request.JobCardId, cancellationToken);

		if (jobCard is null)
			throw new KeyNotFoundException("Job Card not found.");

		var existingInvoice = await _db.Invoices
			.FirstOrDefaultAsync(i => i.JobCardId == jobCard.Id && !i.IsDeleted, cancellationToken);

		if (existingInvoice is not null)
			throw new InvalidOperationException($"An invoice already exists for this Job Card: {existingInvoice.InvoiceNumber ?? existingInvoice.Id.ToString()}");

		var now = DateTime.UtcNow;

		var isGstEnabled = jobCard.JobCardServices.Any(s => !s.IsDeleted && s.TaxPercentage > 0);

		var invoiceItems = jobCard.JobCardServices
			.Where(s => !s.IsDeleted)
			.OrderBy(s => s.CreatedAt)
			.Select(s =>
			{
				var itemTaxRate = isGstEnabled ? (s.TaxPercentage > 0 ? s.TaxPercentage : 18m) : 0m;
				var itemBase = Math.Round(s.UnitPrice * s.Quantity, 2);
				var itemTax = isGstEnabled ? Math.Round(itemBase * itemTaxRate / 100m, 2) : 0m;
				var itemTotal = itemBase + itemTax - s.DiscountAmount;

				return new InvoiceItem
				{
					Id = Guid.NewGuid(),
					ServiceId = s.ServiceId,
					Description = s.ServiceName,
					Quantity = s.Quantity,
					UnitPrice = s.UnitPrice,
					Discount = s.DiscountAmount,
					TaxableAmount = itemBase,
					TaxAmount = itemTax,
					TotalAmount = itemTotal,
					CreatedAt = now,
					UpdatedAt = now,
					IsDeleted = false
				};
			})
			.ToList();

		var subtotal = Math.Round(invoiceItems.Sum(i => i.UnitPrice * i.Quantity), 2);
		var invoiceDiscount = 0m;
		var gstBase = Math.Max(0m, subtotal - invoiceDiscount);
		var taxableAmount = gstBase;

		var cgst = isGstEnabled ? Math.Round(gstBase * 0.09m, 2) : 0m;
		var sgst = isGstEnabled ? Math.Round(gstBase * 0.09m, 2) : 0m;
		var gstAmount = cgst + sgst;
		var totalAmount = gstBase + gstAmount;
		var paidAmount = 0m;
		var balanceAmount = totalAmount;

		var invoice = new Invoice
		{
			Id = Guid.NewGuid(),
			InvoiceNumber = null, // Invoice number is generated only on explicit finalization
			JobCardId = jobCard.Id,
			CustomerId = jobCard.CustomerId,
			VehicleId = jobCard.VehicleId,
			InvoiceDate = now.Date,
			Subtotal = subtotal,
			Discount = invoiceDiscount,
			TaxableAmount = taxableAmount,
			GstAmount = gstAmount,
			TotalAmount = totalAmount,
			PaidAmount = paidAmount,
			BalanceAmount = balanceAmount,
			Status = InvoiceStatus.Draft,
			IsGstEnabled = isGstEnabled,
			Notes = jobCard.Notes,
			InvoiceItems = invoiceItems,
			CreatedAt = now,
			UpdatedAt = now,
			IsDeleted = false
		};

		_db.Invoices.Add(invoice);
		await _db.SaveChangesAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: Domain.Constants.AuditActions.CreateDraft,
			module: Domain.Constants.AuditModules.Invoices,
			description: $"Draft invoice created for Job Card '{jobCard.JobCardNumber}'.",
			entityType: "Invoice",
			entityId: invoice.Id,
			entityReference: jobCard.JobCardNumber,
			outcome: "Success",
			cancellationToken: cancellationToken);

		return ToDto(invoice);
	}

	public async Task<InvoiceDto?> UpdateAsync(Guid id, UpdateInvoiceRequest request, CancellationToken cancellationToken = default)
	{
		var invoice = await _db.Invoices
			.Include(i => i.InvoiceItems)
			.Include(i => i.JobCard)
				.ThenInclude(j => j.JobCardServices)
			.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

		if (invoice is null || invoice.IsDeleted) return null;

		// Immutability: finalized invoices cannot be modified
		if (invoice.Status != InvoiceStatus.Draft || !string.IsNullOrEmpty(invoice.InvoiceNumber))
			throw new InvalidOperationException("Finalized invoices cannot be modified.");

		var oldDiscount = invoice.Discount;
		var oldGst = invoice.IsGstEnabled;

		if (request.IsGstEnabled.HasValue)
		{
			invoice.IsGstEnabled = request.IsGstEnabled.Value;
		}

		if (request.Discount.HasValue || request.IsGstEnabled.HasValue)
		{
			var newDiscount = request.Discount.HasValue ? Math.Round(request.Discount.Value, 2) : invoice.Discount;
			if (newDiscount < 0)
				throw new ArgumentOutOfRangeException(nameof(request.Discount), "Discount cannot be negative.");

			if (newDiscount > invoice.Subtotal)
				throw new ArgumentOutOfRangeException(nameof(request.Discount), "Discount cannot exceed subtotal.");

			var isGstEnabled = invoice.IsGstEnabled;

			invoice.Discount = newDiscount;
			var gstBase = Math.Max(0m, invoice.Subtotal - newDiscount);
			invoice.TaxableAmount = gstBase;

			var cgst = isGstEnabled ? Math.Round(gstBase * 0.09m, 2) : 0m;
			var sgst = isGstEnabled ? Math.Round(gstBase * 0.09m, 2) : 0m;
			invoice.GstAmount = cgst + sgst;
			invoice.TotalAmount = gstBase + invoice.GstAmount;
			invoice.BalanceAmount = Math.Max(0m, invoice.TotalAmount - invoice.PaidAmount);
		}

		if (request.Notes is not null)
			invoice.Notes = request.Notes;

		invoice.UpdatedAt = DateTime.UtcNow;

		await _db.SaveChangesAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: Domain.Constants.AuditActions.UpdateDraft,
			module: Domain.Constants.AuditModules.Invoices,
			description: $"Draft invoice '{invoice.Id}' updated.",
			entityType: "Invoice",
			entityId: invoice.Id,
			entityReference: invoice.InvoiceNumber ?? invoice.JobCard?.JobCardNumber,
			oldValues: System.Text.Json.JsonSerializer.Serialize(new { discount = oldDiscount, isGstEnabled = oldGst }),
			newValues: System.Text.Json.JsonSerializer.Serialize(new { discount = invoice.Discount, isGstEnabled = invoice.IsGstEnabled }),
			outcome: "Success",
			cancellationToken: cancellationToken);

		await _db.Entry(invoice).Reference(i => i.Customer).LoadAsync(cancellationToken);
		await _db.Entry(invoice).Reference(i => i.Vehicle).LoadAsync(cancellationToken);
		await _db.Entry(invoice).Reference(i => i.JobCard).LoadAsync(cancellationToken);

		return ToDto(invoice);
	}

	public async Task<InvoiceDto> GenerateInvoiceAsync(Guid id, CancellationToken cancellationToken = default)
	{
		var invoice = await _db.Invoices
			.Include(i => i.InvoiceItems)
			.Include(i => i.JobCard)
				.ThenInclude(j => j.JobCardServices)
			.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

		if (invoice is null || invoice.IsDeleted)
			throw new KeyNotFoundException("Invoice not found.");

		// Duplicate generation protection
		if (invoice.Status != InvoiceStatus.Draft || !string.IsNullOrEmpty(invoice.InvoiceNumber))
			throw new InvalidOperationException("Invoice has already been generated.");

		// Recalculate & validate final financial amounts
		var subtotal = Math.Round(invoice.InvoiceItems.Where(it => !it.IsDeleted).Sum(it => it.UnitPrice * it.Quantity), 2);
		if (subtotal == 0m && invoice.Subtotal > 0m)
			subtotal = invoice.Subtotal;

		if (invoice.Discount < 0)
			throw new ArgumentOutOfRangeException(nameof(invoice.Discount), "Discount cannot be negative.");

		if (invoice.Discount > subtotal)
			throw new ArgumentOutOfRangeException(nameof(invoice.Discount), "Discount cannot exceed subtotal.");

		invoice.Subtotal = subtotal;
		var gstBase = Math.Max(0m, subtotal - invoice.Discount);
		invoice.TaxableAmount = gstBase;

		var cgst = invoice.IsGstEnabled ? Math.Round(gstBase * 0.09m, 2) : 0m;
		var sgst = invoice.IsGstEnabled ? Math.Round(gstBase * 0.09m, 2) : 0m;
		invoice.GstAmount = cgst + sgst;
		invoice.TotalAmount = gstBase + invoice.GstAmount;
		invoice.BalanceAmount = Math.Max(0m, invoice.TotalAmount - invoice.PaidAmount);

		// 1. Generate unique sequential invoice number before opening transaction
		var invoiceNumber = await GenerateInvoiceNumberAsync(cancellationToken);
		invoice.InvoiceNumber = invoiceNumber;

		// 2. Transactional status finalization and audit logging
		using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
		try
		{
			if (invoice.BalanceAmount <= 0 && invoice.PaidAmount >= invoice.TotalAmount && invoice.TotalAmount > 0)
			{
				invoice.Status = InvoiceStatus.Paid;
			}
			else if (invoice.PaidAmount > 0 && invoice.PaidAmount < invoice.TotalAmount)
			{
				invoice.Status = InvoiceStatus.PartiallyPaid;
			}
			else
			{
				invoice.Status = InvoiceStatus.Generated;
			}

			invoice.UpdatedAt = DateTime.UtcNow;

			if (invoice.JobCard != null)
			{
				invoice.JobCard.Status = JobCardStatus.Invoiced;
				invoice.JobCard.UpdatedAt = DateTime.UtcNow;
			}

			await _db.SaveChangesAsync(cancellationToken);

			await _auditLogService.RecordAsync(
				action: Domain.Constants.AuditActions.Generate,
				module: Domain.Constants.AuditModules.Invoices,
				description: $"Invoice {invoice.InvoiceNumber} generated and finalized.",
				entityType: "Invoice",
				entityId: invoice.Id,
				entityReference: invoice.InvoiceNumber,
				newValues: System.Text.Json.JsonSerializer.Serialize(new {
					invoiceNumber = invoice.InvoiceNumber,
					status = invoice.Status.ToString(),
					subtotal = invoice.Subtotal,
					discount = invoice.Discount,
					taxableAmount = invoice.TaxableAmount,
					gstAmount = invoice.GstAmount,
					totalAmount = invoice.TotalAmount,
					isGstEnabled = invoice.IsGstEnabled
				}),
				outcome: "Success",
				cancellationToken: cancellationToken);

			await transaction.CommitAsync(cancellationToken);
		}
		catch
		{
			await transaction.RollbackAsync(cancellationToken);
			throw;
		}

		// Queue WhatsApp invoice finalized notification
		try
		{
			var msg = await _whatsAppService.QueueInvoiceFinalizedNotificationAsync(invoice.Id, null, cancellationToken);
			if (msg != null && msg.Status == WhatsAppMessageStatus.Pending)
			{
				var messageId = msg.Id;
				_ = Task.Run(async () =>
				{
					try
					{
						using var scope = _scopeFactory.CreateScope();
						var svc = scope.ServiceProvider.GetRequiredService<IWhatsAppService>();
						await svc.ProcessMessageAsync(messageId, CancellationToken.None);
					}
					catch { }
				});
			}
		}
		catch
		{
			// WhatsApp notification failure must NEVER fail invoice finalization
		}

		await _db.Entry(invoice).Reference(i => i.Customer).LoadAsync(cancellationToken);
		await _db.Entry(invoice).Reference(i => i.Vehicle).LoadAsync(cancellationToken);
		await _db.Entry(invoice).Reference(i => i.JobCard).LoadAsync(cancellationToken);

		return ToDto(invoice);
	}

	private async Task<string> GenerateInvoiceNumberAsync(CancellationToken cancellationToken)
	{
		var currentYear = DateTime.UtcNow.Year;
		var conn = _db.Database.GetDbConnection();
		var openedLocally = false;
		if (conn.State != System.Data.ConnectionState.Open)
		{
			await conn.OpenAsync(cancellationToken);
			openedLocally = true;
		}

		try
		{
			using var cmd = conn.CreateCommand();

			while (true)
			{
				cmd.CommandText = "SELECT nextval('invoice_number_seq')";
				long nextNumber;
				try
				{
					var result = await cmd.ExecuteScalarAsync(cancellationToken);
					nextNumber = Convert.ToInt64(result);
				}
				catch
				{
					cmd.CommandText = "CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1 INCREMENT 1 MINVALUE 1 OWNED BY NONE; SELECT nextval('invoice_number_seq');";
					var result = await cmd.ExecuteScalarAsync(cancellationToken);
					nextNumber = Convert.ToInt64(result);
				}

				var candidate = string.Concat("INV-", currentYear.ToString(), "-", nextNumber.ToString("D6"));
				var exists = await _db.Invoices.AnyAsync(i => i.InvoiceNumber == candidate, cancellationToken);
				if (!exists)
				{
					return candidate;
				}
			}
		}
		finally
		{
			if (openedLocally && conn.State == System.Data.ConnectionState.Open)
			{
				await conn.CloseAsync();
			}
		}
	}

	public async Task<PaymentDto> RecordPaymentAsync(Guid invoiceId, RecordPaymentRequest request, CancellationToken cancellationToken = default)
	{
		if (request.Amount <= 0)
			throw new ArgumentOutOfRangeException(nameof(request.Amount), "Payment amount must be greater than ₹0.");

		var invoice = await _db.Invoices
			.Include(i => i.Payments)
			.FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);

		if (invoice is null)
			throw new KeyNotFoundException("Invoice not found.");

		if (invoice.Status == InvoiceStatus.Cancelled)
			throw new InvalidOperationException("This invoice has been cancelled and cannot receive payments.");

		if (invoice.Status == InvoiceStatus.Draft || string.IsNullOrWhiteSpace(invoice.InvoiceNumber))
			throw new InvalidOperationException("Cannot record payment on a Draft invoice. Finalize the invoice first.");

		if (request.Amount > invoice.BalanceAmount)
			throw new InvalidOperationException($"Payment amount cannot exceed current balance of ₹{invoice.BalanceAmount:N2}.");

		var cleanMethod = (request.PaymentMethod ?? "").Trim().Replace(" ", "").Replace("_", "");
		if (!Enum.TryParse<PaymentMethod>(cleanMethod, true, out var paymentMethod))
		{
			if (int.TryParse(request.PaymentMethod, out var intMethod) && Enum.IsDefined(typeof(PaymentMethod), intMethod))
			{
				paymentMethod = (PaymentMethod)intMethod;
			}
			else
			{
				throw new ArgumentException($"Invalid payment method '{request.PaymentMethod}'. Valid methods: Cash, UPI, Card, BankTransfer.");
			}
		}

		var payment = new Payment
		{
			Id = Guid.NewGuid(),
			InvoiceId = invoice.Id,
			Amount = Math.Round(request.Amount, 2),
			PaymentMethod = paymentMethod,
			Reference = string.IsNullOrWhiteSpace(request.Reference) ? null : request.Reference.Trim(),
			PaymentDate = request.PaymentDate.HasValue
				? (request.PaymentDate.Value.Kind == DateTimeKind.Unspecified
					? DateTime.SpecifyKind(request.PaymentDate.Value, DateTimeKind.Utc)
					: request.PaymentDate.Value.ToUniversalTime())
				: DateTime.UtcNow,
			CreatedAt = DateTime.UtcNow,
			IsDeleted = false
		};

		var previousStatus = invoice.Status;

		using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
		try
		{
			_db.Payments.Add(payment);
			await _db.SaveChangesAsync(cancellationToken);

			// Recalculate totals from all valid payments
			var totalPaid = await _db.Payments
				.Where(p => p.InvoiceId == invoice.Id && !p.IsDeleted)
				.SumAsync(p => p.Amount, cancellationToken);

			invoice.PaidAmount = Math.Round(totalPaid, 2);
			invoice.BalanceAmount = Math.Max(0m, invoice.TotalAmount - invoice.PaidAmount);

			// Automatic Status calculation
			if (invoice.BalanceAmount <= 0 && invoice.PaidAmount >= invoice.TotalAmount && invoice.TotalAmount > 0)
			{
				invoice.Status = InvoiceStatus.Paid;
			}
			else if (invoice.PaidAmount > 0 && invoice.PaidAmount < invoice.TotalAmount)
			{
				invoice.Status = InvoiceStatus.PartiallyPaid;
			}
			else if (invoice.PaidAmount == 0)
			{
				invoice.Status = InvoiceStatus.Generated;
			}

			invoice.UpdatedAt = DateTime.UtcNow;
			await _db.SaveChangesAsync(cancellationToken);

			await _auditLogService.RecordAsync(
				action: Domain.Constants.AuditActions.PaymentRecorded,
				module: Domain.Constants.AuditModules.Payments,
				description: $"Payment of ₹{payment.Amount:F2} recorded for Invoice '{invoice.InvoiceNumber}'. Method: {payment.PaymentMethod}.",
				entityType: "Payment",
				entityId: payment.Id,
				entityReference: invoice.InvoiceNumber,
				newValues: System.Text.Json.JsonSerializer.Serialize(new {
					invoiceNumber = invoice.InvoiceNumber,
					amount = payment.Amount,
					paymentMethod = payment.PaymentMethod.ToString(),
					reference = payment.Reference,
					balanceRemaining = invoice.BalanceAmount
				}),
				outcome: "Success",
				cancellationToken: cancellationToken);

			await transaction.CommitAsync(cancellationToken);
		}
		catch
		{
			await transaction.RollbackAsync(cancellationToken);
			throw;
		}

		// Trigger WhatsApp payment completed notification if transitioned to Paid
		if (previousStatus != InvoiceStatus.Paid && invoice.Status == InvoiceStatus.Paid)
		{
			try
			{
				var msg = await _whatsAppService.QueuePaymentCompletedNotificationAsync(invoice.Id, payment.Amount, null, cancellationToken);
				if (msg != null && msg.Status == WhatsAppMessageStatus.Pending)
				{
					var messageId = msg.Id;
					_ = Task.Run(async () =>
					{
						try
						{
							using var scope = _scopeFactory.CreateScope();
							var svc = scope.ServiceProvider.GetRequiredService<IWhatsAppService>();
							await svc.ProcessMessageAsync(messageId, CancellationToken.None);
						}
						catch { }
					});
				}
			}
			catch
			{
				// WhatsApp notification failure must NEVER fail payment recording
			}
		}

		return new PaymentDto(
			payment.Id,
			payment.InvoiceId,
			payment.Amount,
			payment.PaymentMethod.ToString(),
			payment.Reference,
			payment.PaymentDate,
			payment.CreatedAt);
	}

	public async Task<IReadOnlyList<PaymentDto>> GetPaymentsByInvoiceIdAsync(Guid invoiceId, CancellationToken cancellationToken = default)
	{
		var exists = await _db.Invoices.AnyAsync(i => i.Id == invoiceId, cancellationToken);
		if (!exists)
			throw new KeyNotFoundException("Invoice not found.");

		return await _db.Payments
			.Where(p => p.InvoiceId == invoiceId && !p.IsDeleted)
			.OrderByDescending(p => p.PaymentDate)
			.ThenByDescending(p => p.CreatedAt)
			.Select(p => new PaymentDto(
				p.Id,
				p.InvoiceId,
				p.Amount,
				p.PaymentMethod.ToString(),
				p.Reference,
				p.PaymentDate,
				p.CreatedAt))
			.ToListAsync(cancellationToken);
	}

	private static InvoiceDto ToDto(Invoice i) => new(
		i.Id,
		i.InvoiceNumber,
		i.JobCardId,
		i.JobCard.JobCardNumber,
		i.CustomerId,
		i.Customer.Name,
		i.Customer.PhoneNumber,
		i.VehicleId,
		i.Vehicle.RegistrationNumber,
		i.Vehicle.Make,
		i.Vehicle.Model,
		i.Vehicle.Variant,
		i.Vehicle.Color,
		i.InvoiceDate,
		i.Subtotal,
		i.Discount,
		i.TaxableAmount,
		i.GstAmount,
		i.TotalAmount,
		i.PaidAmount,
		i.BalanceAmount,
		i.Status,
		i.Notes,
		i.IsGstEnabled,
		i.InvoiceItems.Select(it => new InvoiceItemDto(
			it.Id,
			it.ServiceId,
			it.Description,
			it.Quantity,
			it.UnitPrice,
			it.Discount,
			it.TaxableAmount,
			it.TaxAmount,
			it.TotalAmount)).ToList(),
		i.Payments.Where(p => !p.IsDeleted)
			.OrderByDescending(p => p.PaymentDate)
			.ThenByDescending(p => p.CreatedAt)
			.Select(p => new PaymentDto(
				p.Id,
				p.InvoiceId,
				p.Amount,
				p.PaymentMethod.ToString(),
				p.Reference,
				p.PaymentDate,
				p.CreatedAt)).ToList(),
		i.CreatedAt,
		i.UpdatedAt);

	private static InvoiceListDto ToListDto(Invoice i) => new(
		i.Id,
		i.InvoiceNumber,
		i.JobCard.JobCardNumber,
		i.Customer.Name,
		i.Customer.PhoneNumber,
		i.Vehicle.RegistrationNumber,
		string.Concat(i.Vehicle.Make, " ", i.Vehicle.Model),
		i.InvoiceDate,
		i.TotalAmount,
		i.PaidAmount,
		i.BalanceAmount,
		i.Status,
		i.CreatedAt);

	public async Task<InvoicePublicLinkResponse> CreatePublicLinkAsync(Guid invoiceId, CancellationToken cancellationToken = default)
	{
		var invoice = await _db.Invoices
			.FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);

		if (invoice is null || invoice.IsDeleted)
			throw new KeyNotFoundException("Invoice not found.");

		if (invoice.Status == InvoiceStatus.Draft || string.IsNullOrEmpty(invoice.InvoiceNumber))
			throw new InvalidOperationException("Public invoice link can only be created for finalized invoices.");

		if (invoice.Status == InvoiceStatus.Cancelled)
			throw new InvalidOperationException("Cannot create public invoice link for a cancelled invoice.");

		var existingActiveLink = await _db.InvoicePublicLinks
			.FirstOrDefaultAsync(l => l.InvoiceId == invoiceId && !l.IsRevoked && !l.IsDeleted, cancellationToken);

		if (existingActiveLink is not null)
		{
			throw new InvalidOperationException("An active public link already exists for this invoice. Use rotate to generate a new link.");
		}

		var rawToken = GenerateSecureToken();
		var tokenHash = ComputeSha256Hash(rawToken);
		var currentUserId = GetCurrentUserId();
		var now = DateTime.UtcNow;

		var link = new InvoicePublicLink
		{
			Id = Guid.NewGuid(),
			InvoiceId = invoice.Id,
			TokenHash = tokenHash,
			CreatedAtUtc = now,
			CreatedByUserId = currentUserId,
			AccessCount = 0,
			IsRevoked = false,
			CreatedAt = now,
			UpdatedAt = now,
			IsDeleted = false
		};

		_db.InvoicePublicLinks.Add(link);
		await _db.SaveChangesAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: Domain.Constants.AuditActions.PublicInvoiceLinkCreated,
			module: Domain.Constants.AuditModules.Invoices,
			description: $"Public invoice link created for invoice '{invoice.InvoiceNumber}'.",
			entityType: "InvoicePublicLink",
			entityId: link.Id,
			entityReference: invoice.InvoiceNumber,
			outcome: "Success",
			cancellationToken: cancellationToken);

		return new InvoicePublicLinkResponse(
			Url: GetPublicInvoiceUrl(rawToken),
			CreatedAtUtc: link.CreatedAtUtc,
			IsActive: true
		);
	}

	public async Task<InvoicePublicLinkStatusResponse> GetPublicLinkStatusAsync(Guid invoiceId, CancellationToken cancellationToken = default)
	{
		var invoice = await _db.Invoices
			.FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);

		if (invoice is null || invoice.IsDeleted)
			throw new KeyNotFoundException("Invoice not found.");

		var activeLink = await _db.InvoicePublicLinks
			.AsNoTracking()
			.Where(l => l.InvoiceId == invoiceId && !l.IsRevoked && !l.IsDeleted)
			.OrderByDescending(l => l.CreatedAtUtc)
			.FirstOrDefaultAsync(cancellationToken);

		if (activeLink is null)
		{
			return new InvoicePublicLinkStatusResponse(
				HasActiveLink: false,
				CreatedAtUtc: null,
				AccessCount: 0,
				LastAccessedAtUtc: null
			);
		}

		return new InvoicePublicLinkStatusResponse(
			HasActiveLink: true,
			CreatedAtUtc: activeLink.CreatedAtUtc,
			AccessCount: activeLink.AccessCount,
			LastAccessedAtUtc: activeLink.LastAccessedAtUtc
		);
	}

	public async Task<bool> RevokePublicLinkAsync(Guid invoiceId, CancellationToken cancellationToken = default)
	{
		var invoice = await _db.Invoices
			.FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);

		if (invoice is null || invoice.IsDeleted)
			throw new KeyNotFoundException("Invoice not found.");

		var activeLinks = await _db.InvoicePublicLinks
			.Where(l => l.InvoiceId == invoiceId && !l.IsRevoked && !l.IsDeleted)
			.ToListAsync(cancellationToken);

		if (activeLinks.Count == 0)
			return true;

		var currentUserId = GetCurrentUserId();
		var now = DateTime.UtcNow;

		foreach (var link in activeLinks)
		{
			link.IsRevoked = true;
			link.RevokedAtUtc = now;
			link.RevokedByUserId = currentUserId;
			link.UpdatedAt = now;
		}

		await _db.SaveChangesAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: Domain.Constants.AuditActions.PublicInvoiceLinkRevoked,
			module: Domain.Constants.AuditModules.Invoices,
			description: $"Public invoice link revoked for invoice '{invoice.InvoiceNumber ?? invoice.Id.ToString()}'.",
			entityType: "InvoicePublicLink",
			entityId: activeLinks[0].Id,
			entityReference: invoice.InvoiceNumber,
			outcome: "Success",
			cancellationToken: cancellationToken);

		return true;
	}

	public async Task<InvoicePublicLinkResponse> RotatePublicLinkAsync(Guid invoiceId, CancellationToken cancellationToken = default)
	{
		var invoice = await _db.Invoices
			.FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);

		if (invoice is null || invoice.IsDeleted)
			throw new KeyNotFoundException("Invoice not found.");

		if (invoice.Status == InvoiceStatus.Draft || string.IsNullOrEmpty(invoice.InvoiceNumber))
			throw new InvalidOperationException("Public invoice link can only be generated for finalized invoices.");

		if (invoice.Status == InvoiceStatus.Cancelled)
			throw new InvalidOperationException("Cannot rotate public invoice link for a cancelled invoice.");

		var currentUserId = GetCurrentUserId();
		var now = DateTime.UtcNow;

		var activeLinks = await _db.InvoicePublicLinks
			.Where(l => l.InvoiceId == invoiceId && !l.IsRevoked && !l.IsDeleted)
			.ToListAsync(cancellationToken);

		foreach (var activeLink in activeLinks)
		{
			activeLink.IsRevoked = true;
			activeLink.RevokedAtUtc = now;
			activeLink.RevokedByUserId = currentUserId;
			activeLink.UpdatedAt = now;
		}

		var rawToken = GenerateSecureToken();
		var tokenHash = ComputeSha256Hash(rawToken);

		var newLink = new InvoicePublicLink
		{
			Id = Guid.NewGuid(),
			InvoiceId = invoice.Id,
			TokenHash = tokenHash,
			CreatedAtUtc = now,
			CreatedByUserId = currentUserId,
			AccessCount = 0,
			IsRevoked = false,
			CreatedAt = now,
			UpdatedAt = now,
			IsDeleted = false
		};

		_db.InvoicePublicLinks.Add(newLink);
		await _db.SaveChangesAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: Domain.Constants.AuditActions.PublicInvoiceLinkRotated,
			module: Domain.Constants.AuditModules.Invoices,
			description: $"Public invoice link rotated for invoice '{invoice.InvoiceNumber}'.",
			entityType: "InvoicePublicLink",
			entityId: newLink.Id,
			entityReference: invoice.InvoiceNumber,
			outcome: "Success",
			cancellationToken: cancellationToken);

		return new InvoicePublicLinkResponse(
			Url: GetPublicInvoiceUrl(rawToken),
			CreatedAtUtc: newLink.CreatedAtUtc,
			IsActive: true
		);
	}

	public async Task<PublicInvoiceDto?> GetPublicInvoiceByTokenAsync(string token, CancellationToken cancellationToken = default)
	{
		if (string.IsNullOrWhiteSpace(token) || token.Length != 64 || !token.All(Uri.IsHexDigit))
			return null;

		var tokenHash = ComputeSha256Hash(token.ToLowerInvariant());

		var link = await _db.InvoicePublicLinks
			.Include(l => l.Invoice)
				.ThenInclude(i => i.Customer)
			.Include(l => l.Invoice)
				.ThenInclude(i => i.Vehicle)
			.Include(l => l.Invoice)
				.ThenInclude(i => i.InvoiceItems)
			.FirstOrDefaultAsync(l => l.TokenHash == tokenHash && !l.IsDeleted, cancellationToken);

		if (link is null || link.IsRevoked)
			return null;

		if (link.ExpiresAtUtc.HasValue && link.ExpiresAtUtc.Value <= DateTime.UtcNow)
			return null;

		var invoice = link.Invoice;
		if (invoice is null || invoice.IsDeleted)
			return null;

		// Draft and Cancelled invoices are strictly inaccessible
		if (invoice.Status == InvoiceStatus.Draft || string.IsNullOrEmpty(invoice.InvoiceNumber) || invoice.Status == InvoiceStatus.Cancelled)
			return null;

		// Safe Access Tracking: Increment AccessCount and update LastAccessedAtUtc
		// Do NOT create an AuditLog entry for customer views
		link.AccessCount++;
		link.LastAccessedAtUtc = DateTime.UtcNow;
		await _db.SaveChangesAsync(cancellationToken);

		var profile = await _db.BusinessProfiles.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
		var isGst = invoice.IsGstEnabled;

		var businessDto = new PublicBusinessDto(
			BusinessName: profile?.BusinessName ?? "E6 Car Spa",
			AddressLine1: profile?.AddressLine1 ?? "36, Geetha Nagar Main Road",
			AddressLine2: profile?.AddressLine2 ?? "Behind Sakthi Mahal, Perundurai Road",
			City: profile?.City ?? "Erode",
			State: profile?.State ?? "Tamil Nadu",
			PostalCode: profile?.PostalCode ?? "638011",
			Phone: profile?.Phone ?? "9578749449",
			Email: profile?.Email ?? "e6carspaerd@gmail.com",
			Gstin: isGst && !string.IsNullOrWhiteSpace(profile?.Gstin) ? profile.Gstin.Trim() : null,
			LogoUrl: profile?.LogoPath ?? "/uploads/logos/e6-logo.png"
		);

		var vehicleName = string.Join(" ", new[] { invoice.Vehicle?.Make, invoice.Vehicle?.Model }.Where(s => !string.IsNullOrWhiteSpace(s)));
		if (!string.IsNullOrWhiteSpace(invoice.Vehicle?.Variant))
		{
			vehicleName = string.IsNullOrWhiteSpace(vehicleName) ? invoice.Vehicle.Variant : $"{vehicleName} ({invoice.Vehicle.Variant})";
		}

		var customerDto = new PublicCustomerDto(
			CustomerName: invoice.Customer?.Name ?? "Customer",
			VehicleName: string.IsNullOrWhiteSpace(vehicleName) ? "Vehicle" : vehicleName,
			RegistrationNumber: invoice.Vehicle?.RegistrationNumber ?? "—"
		);

		var items = invoice.InvoiceItems
			.Where(ii => !ii.IsDeleted)
			.OrderBy(ii => ii.CreatedAt)
			.Select(ii => new PublicInvoiceItemDto(
				Description: ii.Description,
				Quantity: ii.Quantity,
				Rate: ii.UnitPrice,
				Amount: Math.Round(ii.UnitPrice * ii.Quantity, 2),
				HsnSac: isGst ? "998729" : null
			))
			.ToList();

		var cgst = isGst ? Math.Round(invoice.GstAmount / 2m, 2) : (decimal?)null;
		var sgst = isGst ? Math.Round(invoice.GstAmount / 2m, 2) : (decimal?)null;
		var taxableValue = isGst ? invoice.TaxableAmount : (decimal?)null;

		var financials = new PublicFinancialsDto(
			Subtotal: invoice.Subtotal,
			Discount: invoice.Discount,
			TaxableValue: taxableValue,
			Cgst: cgst,
			Sgst: sgst,
			TotalAmount: invoice.TotalAmount,
			PaidAmount: invoice.PaidAmount,
			BalanceAmount: invoice.BalanceAmount
		);

		return new PublicInvoiceDto(
			InvoiceNumber: invoice.InvoiceNumber,
			InvoiceDate: invoice.InvoiceDate,
			Status: invoice.Status.ToString(),
			IsGstEnabled: isGst,
			Business: businessDto,
			Customer: customerDto,
			Items: items,
			Financials: financials,
			Notes: invoice.Notes,
			TermsAndConditions: "1. Payment is due upon completion of vehicle detailing services.\n2. Goods/services once provided are non-refundable.\n3. Please inspect your vehicle thoroughly prior to delivery handover."
		);
	}

	private static string GenerateSecureToken()
	{
		var bytes = RandomNumberGenerator.GetBytes(32);
		return Convert.ToHexString(bytes).ToLowerInvariant();
	}

	private static string ComputeSha256Hash(string token)
	{
		var bytes = Encoding.UTF8.GetBytes(token);
		var hashBytes = SHA256.HashData(bytes);
		return Convert.ToHexString(hashBytes).ToLowerInvariant();
	}

	private string GetPublicInvoiceUrl(string rawToken)
	{
		var baseUrl = _configuration["PublicInvoiceBaseUrl"] ?? "http://localhost:5173";
		baseUrl = baseUrl.TrimEnd('/');
		return $"{baseUrl}/i/{rawToken}";
	}

	private Guid? GetCurrentUserId()
	{
		var claimsPrincipal = _httpContextAccessor.HttpContext?.User;
		if (claimsPrincipal?.Identity?.IsAuthenticated != true)
			return null;

		var userIdStr = claimsPrincipal.FindFirstValue(ClaimTypes.NameIdentifier)
						?? claimsPrincipal.FindFirstValue("sub");

		if (Guid.TryParse(userIdStr, out var parsedId))
			return parsedId;

		return null;
	}
}
