using CarSpaManagement.Api.Application.Common;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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
	private readonly InvoiceNumberAllocator _numberAllocator;
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
		_numberAllocator = new InvoiceNumberAllocator(db);
		_auditLogService = auditLogService;
		_configuration = configuration;
		_httpContextAccessor = httpContextAccessor;
		_whatsAppService = whatsAppService;
		_scopeFactory = scopeFactory;
	}

	public async Task<IReadOnlyList<InvoiceListDto>> GetAllAsync(int page, int pageSize, string? search = null, InvoiceStatus? status = null, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default)
	{
		var query = _db.Invoices
			.Where(i => !i.IsDeleted)
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
				|| (i.Customer != null && i.Customer.Name != null && i.Customer.Name.ToLower().Contains(search))
				|| (i.Vehicle != null && i.Vehicle.RegistrationNumber != null && i.Vehicle.RegistrationNumber.ToLower().Contains(search))
				|| (i.JobCard != null && i.JobCard.JobCardNumber != null && i.JobCard.JobCardNumber.ToLower().Contains(search)));
		}

		return await query.OrderByDescending(i => i.CreatedAt)
			.Skip((page - 1) * pageSize)
			.Take(pageSize)
			.Select(i => ToListDto(i))
			.ToListAsync(cancellationToken);
	}

	public async Task<int> GetTotalCountAsync(string? search = null, InvoiceStatus? status = null, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default)
	{
		var query = _db.Invoices.Where(i => !i.IsDeleted).AsQueryable();

		if (status.HasValue) query = query.Where(i => i.Status == status.Value);
		if (fromDate.HasValue) query = query.Where(i => i.InvoiceDate >= fromDate.Value);
		if (toDate.HasValue) query = query.Where(i => i.InvoiceDate <= toDate.Value.AddDays(1));

		if (!string.IsNullOrWhiteSpace(search))
		{
			search = search.Trim().ToLower();
			query = query.Where(i => (i.InvoiceNumber != null && i.InvoiceNumber.ToLower().Contains(search))
				|| (i.Customer != null && i.Customer.Name != null && i.Customer.Name.ToLower().Contains(search))
				|| (i.Vehicle != null && i.Vehicle.RegistrationNumber != null && i.Vehicle.RegistrationNumber.ToLower().Contains(search))
				|| (i.JobCard != null && i.JobCard.JobCardNumber != null && i.JobCard.JobCardNumber.ToLower().Contains(search)));
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
			.Include(j => j.OutsideJobs)
			.FirstOrDefaultAsync(j => j.Id == request.JobCardId, cancellationToken);

		if (jobCard is null)
			throw new KeyNotFoundException("Job Card not found.");

		var existingInvoice = await _db.Invoices
			.FirstOrDefaultAsync(i => i.JobCardId == jobCard.Id && !i.IsDeleted, cancellationToken);

		if (existingInvoice is not null)
			throw new InvalidOperationException($"An invoice already exists for this Job Card: {existingInvoice.InvoiceNumber ?? existingInvoice.Id.ToString()}");

		// Check outside jobs: Vendor cost is mandatory for all active outside jobs before generating the invoice
		var activeOutsideJobs = (jobCard.OutsideJobs ?? Enumerable.Empty<OutsideJob>())
			.Where(oj => !oj.IsDeleted && oj.Status != OutsideJobStatus.Cancelled)
			.ToList();

		var missingCostJobs = activeOutsideJobs
			.Where(oj => !oj.VendorCost.HasValue || oj.VendorCost.Value <= 0)
			.ToList();

		if (missingCostJobs.Any())
		{
			var missingNames = string.Join(", ", missingCostJobs.Select(j => $"'{j.ServiceName}'"));
			throw new InvalidOperationException($"Vendor cost is required for all outside jobs before generating the invoice. Missing cost for: {missingNames}.");
		}

		var now = DateTime.UtcNow;

		var isGstEnabled = jobCard.JobCardServices.Any(s => !s.IsDeleted && s.TaxPercentage > 0);

		var invoiceItems = jobCard.JobCardServices
			.Where(s => !s.IsDeleted)
			.OrderBy(s => s.CreatedAt)
			.Select(s => new InvoiceItem
			{
				Id = Guid.NewGuid(),
				ServiceId = s.ServiceId,
				Description = s.ServiceName,
				Quantity = s.Quantity,
				UnitPrice = s.UnitPrice,
				Discount = s.DiscountAmount,
				CreatedAt = now,
				UpdatedAt = now,
				IsDeleted = false
			})
			.ToList();

		// Add billable outside jobs (Returned status with a final vendor cost)
		var eligibleOutsideJobs = activeOutsideJobs
			.Where(oj => oj.Status == OutsideJobStatus.Returned
				&& oj.VendorCost.HasValue
				&& oj.VendorCost.Value > 0)
			.ToList();

		foreach (var oj in eligibleOutsideJobs)
		{
			invoiceItems.Add(new InvoiceItem
			{
				Id = Guid.NewGuid(),
				OutsideJobId = oj.Id,
				Description = oj.ServiceName,
				Quantity = 1,
				UnitPrice = InvoiceCalculator.Round(oj.VendorCost!.Value),
				Discount = 0m,
				CreatedAt = now,
				UpdatedAt = now,
				IsDeleted = false
			});
		}

		var invoice = new Invoice
		{
			Id = Guid.NewGuid(),
			InvoiceNumber = null, // Invoice number is generated only on explicit finalization
			JobCardId = jobCard.Id,
			CustomerId = jobCard.CustomerId,
			VehicleId = jobCard.VehicleId,
			InvoiceDate = now.Date,
			Discount = 0m,
			PaidAmount = 0m,
			Status = InvoiceStatus.Draft,
			IsGstEnabled = isGstEnabled,
			Notes = jobCard.Notes,
			InvoiceItems = invoiceItems,
			CreatedAt = now,
			UpdatedAt = now,
			IsDeleted = false
		};

		InvoiceCalculator.ApplyToInvoice(invoice,
			await InvoiceTaxRates.ForDraftAsync(_db, invoice, jobCard.JobCardServices, cancellationToken));

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

		if (request.Discount.HasValue || request.IsGstEnabled.HasValue)
			await ApplyDraftFinancialsAsync(invoice, request.Discount, request.IsGstEnabled, cancellationToken);

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

	/// <summary>
	/// Calculates a draft with the given (unsaved) discount / GST choice through the authoritative calculator and
	/// returns it without persisting anything. Clients show these values instead of calculating GST themselves.
	/// </summary>
	public async Task<InvoiceDto> PreviewAsync(Guid id, PreviewInvoiceRequest request, CancellationToken cancellationToken = default)
	{
		var invoice = await _db.Invoices
			.AsNoTracking()
			.Include(i => i.Customer)
			.Include(i => i.Vehicle)
			.Include(i => i.InvoiceItems)
			.Include(i => i.Payments)
			.Include(i => i.JobCard)
				.ThenInclude(j => j.JobCardServices)
			.Include(i => i.JobCard)
				.ThenInclude(j => j.OutsideJobs)
			.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

		if (invoice is null || invoice.IsDeleted)
			throw new KeyNotFoundException("Invoice not found.");

		// Finalized invoices are never recalculated: their stored amounts are returned unchanged.
		if (invoice.Status != InvoiceStatus.Draft || !string.IsNullOrEmpty(invoice.InvoiceNumber))
			return ToDto(invoice);

		// Synchronize outside jobs in-memory for preview calculation
		if (invoice.JobCard?.OutsideJobs != null)
		{
			var activeOutsideJobs = invoice.JobCard.OutsideJobs
				.Where(oj => !oj.IsDeleted && oj.Status != OutsideJobStatus.Cancelled)
				.ToList();

			// Clean up any draft invoice items for outside jobs that have since been deleted or cancelled
			foreach (var item in invoice.InvoiceItems.Where(it => !it.IsDeleted && it.OutsideJobId.HasValue))
			{
				var oj = invoice.JobCard.OutsideJobs.FirstOrDefault(o => o.Id == item.OutsideJobId!.Value);
				if (oj == null || oj.IsDeleted || oj.Status == OutsideJobStatus.Cancelled)
				{
					item.IsDeleted = true;
				}
				else if (oj.VendorCost.HasValue && oj.VendorCost.Value > 0 && item.UnitPrice != InvoiceCalculator.Round(oj.VendorCost.Value))
				{
					item.UnitPrice = InvoiceCalculator.Round(oj.VendorCost.Value);
				}
			}

			var existingOjIds = invoice.InvoiceItems
				.Where(it => !it.IsDeleted && it.OutsideJobId.HasValue)
				.Select(it => it.OutsideJobId!.Value)
				.ToHashSet();

			var newEligibleOjs = activeOutsideJobs
				.Where(oj => oj.Status == OutsideJobStatus.Returned
					&& oj.VendorCost.HasValue
					&& oj.VendorCost.Value > 0
					&& !existingOjIds.Contains(oj.Id))
				.ToList();

			foreach (var oj in newEligibleOjs)
			{
				invoice.InvoiceItems.Add(new InvoiceItem
				{
					Id = Guid.NewGuid(),
					InvoiceId = invoice.Id,
					OutsideJobId = oj.Id,
					Description = oj.ServiceName,
					Quantity = 1,
					UnitPrice = InvoiceCalculator.Round(oj.VendorCost!.Value),
					Discount = 0m,
					CreatedAt = DateTime.UtcNow,
					UpdatedAt = DateTime.UtcNow,
					IsDeleted = false
				});
			}
		}

		await ApplyDraftFinancialsAsync(invoice, request.Discount, request.IsGstEnabled, cancellationToken);
		return ToDto(invoice);
	}

	/// <summary>Applies a discount / GST choice to a draft and recalculates it. Callers decide whether to save.</summary>
	private async Task ApplyDraftFinancialsAsync(Invoice invoice, decimal? discount, bool? isGstEnabled, CancellationToken cancellationToken)
	{
		if (isGstEnabled.HasValue)
			invoice.IsGstEnabled = isGstEnabled.Value;

		var newDiscount = discount.HasValue ? InvoiceCalculator.Round(discount.Value) : invoice.Discount;
		if (newDiscount < 0)
			throw new ArgumentOutOfRangeException(nameof(discount), "Discount cannot be negative.");

		invoice.Discount = newDiscount;
		if (invoice.InvoiceItems.Any(i => !i.IsDeleted))
		{
			InvoiceCalculator.ApplyToInvoice(invoice,
				await InvoiceTaxRates.ForDraftAsync(_db, invoice, invoice.JobCard?.JobCardServices, cancellationToken));
		}
		else
		{
			// Legacy invoice without line items: header-only recalculation at the standard rate.
			if (newDiscount > invoice.Subtotal)
				throw new ArgumentOutOfRangeException(nameof(discount), "Discount cannot exceed subtotal.");
			var header = InvoiceCalculator.Calculate(
				[new InvoiceCalculator.LineInput(1, invoice.Subtotal, 0m, InvoiceCalculator.StandardGstRatePercent)],
				newDiscount,
				invoice.IsGstEnabled);
			invoice.TaxableAmount = header.Taxable;
			invoice.GstAmount = header.GstAmount;
			invoice.TotalAmount = header.Total;
			invoice.BalanceAmount = Math.Max(0m, invoice.TotalAmount - invoice.PaidAmount);
		}
	}

	public async Task<InvoiceDto> GenerateInvoiceAsync(Guid id, decimal? expectedTotalAmount, CancellationToken cancellationToken = default, bool canEditDraft = false)
	{
		if (!expectedTotalAmount.HasValue)
			throw new ArgumentException("Expected total amount is required for invoice generation.", nameof(expectedTotalAmount));

		if (expectedTotalAmount.Value < 0)
			throw new ArgumentOutOfRangeException(nameof(expectedTotalAmount), "Expected total amount cannot be negative.");

		var invoice = await _db.Invoices
			.Include(i => i.InvoiceItems)
			.Include(i => i.JobCard)
				.ThenInclude(j => j.JobCardServices)
			.Include(i => i.JobCard)
				.ThenInclude(j => j.OutsideJobs)
			.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

		if (invoice is null || invoice.IsDeleted)
			throw new KeyNotFoundException("Invoice not found.");

		// Duplicate generation protection
		if (invoice.Status != InvoiceStatus.Draft || !string.IsNullOrEmpty(invoice.InvoiceNumber))
			throw new InvalidOperationException("Invoice has already been generated.");

		// Outside Jobs Validation: Vendor cost is mandatory for all active outside jobs before generating the invoice
		if (invoice.JobCard?.OutsideJobs != null)
		{
			var activeOutsideJobs = invoice.JobCard.OutsideJobs
				.Where(oj => !oj.IsDeleted && oj.Status != OutsideJobStatus.Cancelled)
				.ToList();

			var missingCostJobs = activeOutsideJobs
				.Where(oj => !oj.VendorCost.HasValue || oj.VendorCost.Value <= 0)
				.ToList();

			if (missingCostJobs.Any())
			{
				var missingNames = string.Join(", ", missingCostJobs.Select(j => $"'{j.ServiceName}'"));
				throw new InvalidOperationException($"Vendor cost is required for all outside jobs before generating the invoice. Missing cost for: {missingNames}.");
			}

			// Clean up any draft invoice items for outside jobs that have since been deleted or cancelled
			var existingOjItems = invoice.InvoiceItems.Where(it => !it.IsDeleted && it.OutsideJobId.HasValue).ToList();
			var existingOjIds = existingOjItems.Select(it => it.OutsideJobId!.Value).ToHashSet();

			var itemsToRemove = existingOjItems.Where(it => {
				var oj = invoice.JobCard!.OutsideJobs.FirstOrDefault(o => o.Id == it.OutsideJobId!.Value);
				return oj == null || oj.IsDeleted || oj.Status == OutsideJobStatus.Cancelled;
			}).ToList();

			var itemsWithCostChange = existingOjItems.Where(it => {
				var oj = invoice.JobCard!.OutsideJobs.FirstOrDefault(o => o.Id == it.OutsideJobId!.Value);
				return oj != null && !oj.IsDeleted && oj.Status != OutsideJobStatus.Cancelled
					&& oj.VendorCost.HasValue && oj.VendorCost.Value > 0
					&& it.UnitPrice != InvoiceCalculator.Round(oj.VendorCost.Value);
			}).ToList();

			var newEligibleOjs = activeOutsideJobs
				.Where(oj => oj.Status == OutsideJobStatus.Returned
					&& oj.VendorCost.HasValue
					&& oj.VendorCost.Value > 0
					&& !existingOjIds.Contains(oj.Id))
				.ToList();

			var requiresDraftModification = itemsToRemove.Count > 0 || itemsWithCostChange.Count > 0 || newEligibleOjs.Count > 0;
			if (requiresDraftModification && !canEditDraft)
			{
				throw new ForbiddenException("Outside-job changes require modifying draft invoice lines. Permission to edit draft invoices (invoices.edit_draft) is required.");
			}

			var syncNow = DateTime.UtcNow;

			foreach (var item in itemsToRemove)
			{
				item.IsDeleted = true;
				item.UpdatedAt = syncNow;
			}

			foreach (var item in itemsWithCostChange)
			{
				var oj = invoice.JobCard!.OutsideJobs.First(o => o.Id == item.OutsideJobId!.Value);
				item.UnitPrice = InvoiceCalculator.Round(oj.VendorCost!.Value);
				item.UpdatedAt = syncNow;
			}

			foreach (var oj in newEligibleOjs)
			{
				var ojItem = new InvoiceItem
				{
					Id = Guid.NewGuid(),
					InvoiceId = invoice.Id,
					OutsideJobId = oj.Id,
					Description = oj.ServiceName,
					Quantity = 1,
					UnitPrice = InvoiceCalculator.Round(oj.VendorCost!.Value),
					Discount = 0m,
					CreatedAt = syncNow,
					UpdatedAt = syncNow,
					IsDeleted = false
				};
				invoice.InvoiceItems.Add(ojItem);
			}
		}

		// Recalculate & validate final financial amounts from the invoice lines
		if (invoice.Discount < 0)
			throw new ArgumentOutOfRangeException(nameof(invoice.Discount), "Discount cannot be negative.");

		InvoiceCalculator.ApplyToInvoice(invoice,
			await InvoiceTaxRates.ForDraftAsync(_db, invoice, invoice.JobCard?.JobCardServices, cancellationToken));

		// The user confirmed an amount: never issue a different one.
		if (InvoiceCalculator.Round(expectedTotalAmount.Value) != invoice.TotalAmount)
			throw new ConflictException(
				$"The invoice total is now ₹{invoice.TotalAmount:N2}, not the ₹{expectedTotalAmount.Value:N2} that was confirmed. Review the invoice and generate it again.");

		// Transactional numbering, status finalization and audit logging
		using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
		try
		{
			// Lock the draft and re-check it is still unnumbered, so two simultaneous finalizations of the
			// same draft (e.g. desktop + Android) cannot both consume a number.
			if (_db.Database.IsRelational())
			{
				await _db.Database.ExecuteSqlInterpolatedAsync(
					$"SELECT 1 FROM \"Invoices\" WHERE \"Id\" = {invoice.Id} FOR UPDATE", cancellationToken);
				var current = await _db.Invoices.AsNoTracking()
					.Where(i => i.Id == invoice.Id)
					.Select(i => new { i.Status, i.InvoiceNumber })
					.SingleAsync(cancellationToken);
				if (current.Status != InvoiceStatus.Draft || !string.IsNullOrEmpty(current.InvoiceNumber))
					throw new InvalidOperationException("Invoice has already been generated.");
			}

			// Series (GST / non-GST) is chosen from the invoice's final IsGstEnabled value; the number, the
			// series counter and the permanent ledger entry all commit or roll back with this transaction.
			await _numberAllocator.AllocateAutomaticAsync(invoice, cancellationToken);

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

		// Ensure public invoice link is created and obtain raw token
		string? rawToken = null;
		string? publicUrl = null;
		try
		{
			var linkResult = await EnsurePublicLinkInternalAsync(invoice.Id, cancellationToken);
			rawToken = linkResult.RawToken;
			publicUrl = linkResult.Url;
		}
		catch
		{
			// Public link creation failure must not block invoice finalization
		}

		// Queue WhatsApp invoice finalized notification
		try
		{
			var msg = await _whatsAppService.QueueInvoiceFinalizedNotificationAsync(invoice.Id, cancellationToken);
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

	public async Task<InvoiceDto> CancelInvoiceAsync(Guid id, string? reason = null, CancellationToken cancellationToken = default)
	{
		var invoice = await _db.Invoices
			.Include(i => i.InvoiceItems)
			.Include(i => i.Payments)
			.Include(i => i.JobCard)
			.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

		if (invoice is null || invoice.IsDeleted)
			throw new KeyNotFoundException("Invoice not found.");

		if (invoice.Status == InvoiceStatus.Cancelled)
			throw new InvalidOperationException("Invoice is already cancelled.");

		if (invoice.Payments.Any(p => !p.IsDeleted && p.Amount > 0) || invoice.PaidAmount > 0)
			throw new InvalidOperationException("Cannot cancel an invoice with recorded payments. Void or refund payments first.");

		var previousStatus = invoice.Status;

		using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
		try
		{
			invoice.Status = InvoiceStatus.Cancelled;
			if (!string.IsNullOrWhiteSpace(reason))
			{
				invoice.Notes = string.IsNullOrWhiteSpace(invoice.Notes)
					? $"Cancelled: {reason.Trim()}"
					: $"{invoice.Notes} | Cancelled: {reason.Trim()}";
			}
			invoice.UpdatedAt = DateTime.UtcNow;

			// Revert linked JobCard status from Invoiced back to Ready so it can be re-addressed
			if (invoice.JobCard != null && invoice.JobCard.Status == JobCardStatus.Invoiced)
			{
				invoice.JobCard.Status = JobCardStatus.Ready;
				invoice.JobCard.UpdatedAt = DateTime.UtcNow;
			}

			// Revoke any active public links
			var activeLinks = await _db.InvoicePublicLinks
				.Where(l => l.InvoiceId == id && !l.IsRevoked && !l.IsDeleted)
				.ToListAsync(cancellationToken);

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
				action: Domain.Constants.AuditActions.Cancel,
				module: Domain.Constants.AuditModules.Invoices,
				description: $"Invoice '{invoice.InvoiceNumber ?? invoice.Id.ToString()}' was cancelled. Reason: {reason ?? "None provided"}.",
				entityType: "Invoice",
				entityId: invoice.Id,
				entityReference: invoice.InvoiceNumber ?? invoice.JobCard?.JobCardNumber,
				oldValues: System.Text.Json.JsonSerializer.Serialize(new { status = previousStatus.ToString() }),
				newValues: System.Text.Json.JsonSerializer.Serialize(new { status = invoice.Status.ToString(), cancellationReason = reason }),
				outcome: "Success",
				cancellationToken: cancellationToken);

			await transaction.CommitAsync(cancellationToken);
		}
		catch
		{
			await transaction.RollbackAsync(cancellationToken);
			throw;
		}

		await _db.Entry(invoice).Reference(i => i.Customer).LoadAsync(cancellationToken);
		await _db.Entry(invoice).Reference(i => i.Vehicle).LoadAsync(cancellationToken);
		if (invoice.JobCard != null)
		{
			await _db.Entry(invoice).Reference(i => i.JobCard).LoadAsync(cancellationToken);
		}

		return ToDto(invoice);
	}


	/// <summary>
	/// Lets the Owner replace the automatically generated number of a fully paid GST invoice with a number
	/// of their choosing. The number sequence is not touched: the generator already skips numbers in use.
	/// </summary>
	public async Task<InvoiceDto> UpdateInvoiceNumberAsync(Guid id, UpdateInvoiceNumberRequest request, CancellationToken cancellationToken = default)
	{
		var currentUserId = GetCurrentUserId();
		var isOwner = currentUserId.HasValue && await _db.Users.AsNoTracking()
			.AnyAsync(u => u.Id == currentUserId.Value && u.IsActive && u.Role == UserRole.Owner, cancellationToken);
		if (!isOwner)
			throw new ForbiddenException("Only the Owner can change an invoice number.");

		var newNumber = InvoiceNumberRules.Normalize(request.InvoiceNumber);

		var invoice = await _db.Invoices
			.Include(i => i.Customer)
			.Include(i => i.Vehicle)
			.Include(i => i.JobCard)
			.Include(i => i.InvoiceItems)
			.Include(i => i.Payments)
			.FirstOrDefaultAsync(i => i.Id == id, cancellationToken)
			?? throw new KeyNotFoundException("Invoice not found.");

		if (!invoice.IsGstEnabled)
			throw new InvalidOperationException("Only GST invoices can have their invoice number changed.");

		if (invoice.Status != InvoiceStatus.Paid || string.IsNullOrWhiteSpace(invoice.InvoiceNumber))
			throw new InvalidOperationException("The invoice number can only be changed after the invoice is fully paid.");

		var oldNumber = invoice.InvoiceNumber;
		if (string.Equals(oldNumber, newNumber, StringComparison.Ordinal))
			return ToDto(invoice);

		// A queued WhatsApp message would otherwise be sent with the old number in its text and the new one on its PDF.
		var hasPendingWhatsApp = await _db.WhatsAppMessages.AnyAsync(
			m => m.InvoiceId == invoice.Id && (m.Status == WhatsAppMessageStatus.Pending || m.Status == WhatsAppMessageStatus.Processing),
			cancellationToken);
		if (hasPendingWhatsApp)
			throw new InvalidOperationException("A WhatsApp message for this invoice is still being sent. Try again in a moment.");

		// A number that was ever issued to another invoice (automatic, manual or legacy, under any prefix)
		// is permanently consumed. Returning to one of this invoice's own earlier numbers is allowed.
		if (await _numberAllocator.IsConsumedAsync(newNumber, invoice.Id, cancellationToken))
			throw new ConflictException($"Invoice number '{newNumber}' has already been issued and cannot be reused.");

		// Old number stays reserved forever; the new one is reserved now. The series counter is not touched.
		await _numberAllocator.ReserveManualAsync(invoice, newNumber, currentUserId, cancellationToken);
		invoice.InvoiceNumber = newNumber;
		invoice.UpdatedAt = DateTime.UtcNow;

		try
		{
			await _db.SaveChangesAsync(cancellationToken);
		}
		catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation })
		{
			throw new ConflictException($"Invoice number '{newNumber}' has already been issued and cannot be reused.");
		}

		await _auditLogService.RecordAsync(
			action: Domain.Constants.AuditActions.InvoiceNumberChanged,
			module: Domain.Constants.AuditModules.Invoices,
			description: $"Invoice number changed from '{oldNumber}' to '{newNumber}'.",
			entityType: "Invoice",
			entityId: invoice.Id,
			entityReference: newNumber,
			oldValues: JsonSerializer.Serialize(new { invoiceNumber = oldNumber }),
			newValues: JsonSerializer.Serialize(new { invoiceNumber = newNumber }),
			outcome: "Success",
			cancellationToken: cancellationToken);

		return ToDto(invoice);
	}


	public async Task<PaymentDto> RecordPaymentAsync(Guid invoiceId, RecordPaymentRequest request, CancellationToken cancellationToken = default)
	{
		if (request.Amount <= 0)
			throw new ArgumentOutOfRangeException(nameof(request.Amount), "Payment amount must be greater than ₹0.");

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

		var amount = Math.Round(request.Amount, 2);
		Payment payment;
		Invoice invoice;
		InvoiceStatus previousStatus;

		using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
		try
		{
			// Serialize concurrent payments for the same invoice: the row lock is held until commit,
			// so a second request waits here and then sees the first payment before validating.
			await LockInvoiceRowAsync(invoiceId, cancellationToken);

			invoice = await _db.Invoices
				.FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken)
				?? throw new KeyNotFoundException("Invoice not found.");

			if (invoice.Status == InvoiceStatus.Cancelled)
				throw new InvalidOperationException("This invoice has been cancelled and cannot receive payments.");

			if (invoice.Status == InvoiceStatus.Draft || string.IsNullOrWhiteSpace(invoice.InvoiceNumber))
				throw new InvalidOperationException("Cannot record payment on a Draft invoice. Finalize the invoice first.");

			// Recalculate the balance from committed payments while holding the lock (never trust a stale header value).
			var paidSoFar = await _db.Payments
				.Where(p => p.InvoiceId == invoice.Id && !p.IsDeleted)
				.SumAsync(p => p.Amount, cancellationToken);
			var currentBalance = Math.Max(0m, invoice.TotalAmount - Math.Round(paidSoFar, 2));

			if (amount > currentBalance)
				throw new InvalidOperationException($"Payment amount cannot exceed current balance of ₹{currentBalance:N2}.");

			payment = new Payment
			{
				Id = Guid.NewGuid(),
				InvoiceId = invoice.Id,
				Amount = amount,
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

			previousStatus = invoice.Status;

			_db.Payments.Add(payment);

			invoice.PaidAmount = Math.Round(paidSoFar + amount, 2);
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

	/// <summary>
	/// Takes a PostgreSQL row lock (SELECT ... FOR UPDATE) on the invoice for the current transaction.
	/// Non-relational providers (unit tests on EF InMemory) have no row locks, so this is a no-op there.
	/// </summary>
	private async Task LockInvoiceRowAsync(Guid invoiceId, CancellationToken cancellationToken)
	{
		if (!_db.Database.IsRelational()) return;
		await _db.Database.ExecuteSqlInterpolatedAsync(
			$"SELECT 1 FROM \"Invoices\" WHERE \"Id\" = {invoiceId} FOR UPDATE", cancellationToken);
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

	private static InvoiceDto ToDto(Invoice i)
	{
		var breakdown = BuildTaxBreakdown(i);
		return new(
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
		i.InvoiceItems.Where(it => !it.IsDeleted).OrderBy(it => it.CreatedAt).Select(ToItemDto).ToList(),
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
		i.UpdatedAt,
		breakdown.Sum(b => b.CgstAmount),
		breakdown.Sum(b => b.SgstAmount),
		breakdown);
	}

	private static InvoiceItemDto ToItemDto(InvoiceItem it)
	{
		var (cgst, sgst) = InvoiceCalculator.SplitTax(it.TaxAmount);
		return new InvoiceItemDto(
			it.Id,
			it.ServiceId,
			it.OutsideJobId,
			it.Description,
			it.Quantity,
			it.UnitPrice,
			it.Discount,
			it.TaxableAmount,
			it.TaxAmount,
			it.TotalAmount,
			it.TaxRatePercent,
			cgst,
			sgst);
	}

	/// <summary>Rate-wise tax summary built from the stored values only (never recalculated).</summary>
	public static IReadOnlyList<TaxBreakdownDto> BuildTaxBreakdown(Invoice invoice) =>
		InvoiceCalculator.SummarizeStoredInvoice(invoice)
			.Select(g => new TaxBreakdownDto(g.RatePercent, g.Taxable, g.Cgst, g.Sgst, g.Tax))
			.ToList();

	private static InvoiceListDto ToListDto(Invoice i) => new(
		i.Id,
		i.InvoiceNumber,
		i.JobCard != null ? i.JobCard.JobCardNumber : "—",
		i.Customer != null ? i.Customer.Name : "—",
		i.Customer != null ? i.Customer.PhoneNumber : "—",
		i.Vehicle != null ? i.Vehicle.RegistrationNumber : "—",
		i.Vehicle != null ? string.Concat(i.Vehicle.Make, " ", i.Vehicle.Model).Trim() : "—",
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

		// Everything shown here comes from the company's own profile; nothing is filled in on its behalf.
		var businessDto = new PublicBusinessDto(
			BusinessName: profile?.BusinessName ?? string.Empty,
			AddressLine1: profile?.AddressLine1,
			AddressLine2: profile?.AddressLine2,
			City: profile?.City,
			State: profile?.State,
			PostalCode: profile?.PostalCode,
			Phone: profile?.Phone,
			Email: profile?.Email,
			Gstin: isGst && !string.IsNullOrWhiteSpace(profile?.Gstin) ? profile.Gstin.Trim() : null,
			LogoUrl: string.IsNullOrWhiteSpace(profile?.LogoPath) ? null : profile.LogoPath,
			Tagline: string.IsNullOrWhiteSpace(profile?.Tagline) ? null : profile.Tagline.Trim(),
			BrandColor: profile?.BrandColor
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
				Amount: InvoiceCalculator.Round(ii.UnitPrice * ii.Quantity) - ii.Discount, // sums to Subtotal, as on every invoice view
				TaxRatePercent: isGst ? ii.TaxRatePercent : null
			))
			.ToList();

		// Stored values only: a finalized invoice is never recalculated.
		var breakdown = BuildTaxBreakdown(invoice);
		var cgst = isGst ? breakdown.Sum(b => b.CgstAmount) : (decimal?)null;
		var sgst = isGst ? breakdown.Sum(b => b.SgstAmount) : (decimal?)null;
		var taxableValue = isGst ? invoice.TaxableAmount : (decimal?)null;

		var financials = new PublicFinancialsDto(
			Subtotal: invoice.Subtotal,
			Discount: invoice.Discount,
			TaxableValue: taxableValue,
			Cgst: cgst,
			Sgst: sgst,
			TotalAmount: invoice.TotalAmount,
			PaidAmount: invoice.PaidAmount,
			BalanceAmount: invoice.BalanceAmount,
			TaxBreakdown: breakdown
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
			TermsAndConditions: string.IsNullOrWhiteSpace(profile?.TermsAndConditions) ? null : profile.TermsAndConditions.Trim()
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
		if (baseUrl.EndsWith("/i", StringComparison.OrdinalIgnoreCase))
		{
			baseUrl = baseUrl.Substring(0, baseUrl.Length - 2).TrimEnd('/');
		}
		return $"{baseUrl}/i/{rawToken}";
	}

	private async Task<(string Url, string RawToken)> EnsurePublicLinkInternalAsync(Guid invoiceId, CancellationToken cancellationToken)
	{
		var activeLink = await _db.InvoicePublicLinks
			.FirstOrDefaultAsync(l => l.InvoiceId == invoiceId && !l.IsRevoked && !l.IsDeleted, cancellationToken);

		if (activeLink != null)
		{
			var existingMsg = await _db.WhatsAppMessages
				.Where(m => m.InvoiceId == invoiceId && !string.IsNullOrEmpty(m.TemplateParametersJson))
				.OrderByDescending(m => m.CreatedAt)
				.FirstOrDefaultAsync(cancellationToken);

			if (existingMsg != null)
			{
				try
				{
					using var doc = JsonDocument.Parse(existingMsg.TemplateParametersJson ?? "{}");
					if (doc.RootElement.TryGetProperty("rawToken", out var rt) && !string.IsNullOrWhiteSpace(rt.GetString()))
					{
						var token = rt.GetString()!;
						return (GetPublicInvoiceUrl(token), token);
					}
				}
				catch { }
			}

			// If raw token is not recoverable, rotate the active link to get a fresh raw token
			activeLink.IsRevoked = true;
			activeLink.RevokedAtUtc = DateTime.UtcNow;
			activeLink.UpdatedAt = DateTime.UtcNow;
		}

		var rawToken = GenerateSecureToken();
		var tokenHash = ComputeSha256Hash(rawToken);
		var now = DateTime.UtcNow;
		var currentUserId = GetCurrentUserId();

		var newLink = new InvoicePublicLink
		{
			Id = Guid.NewGuid(),
			InvoiceId = invoiceId,
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

		return (GetPublicInvoiceUrl(rawToken), rawToken);
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
