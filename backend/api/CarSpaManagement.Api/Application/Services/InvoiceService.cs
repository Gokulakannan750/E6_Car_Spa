using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace CarSpaManagement.Api.Application.Services;

public class InvoiceService : IInvoiceService
{
	private readonly AppDbContext _db;

	public InvoiceService(AppDbContext db)
	{
		_db = db;
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

		// Transactional invoice number generation and status finalization
		using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
		try
		{
			var invoiceNumber = await GenerateInvoiceNumberAsync(cancellationToken);
			invoice.InvoiceNumber = invoiceNumber;

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
			await transaction.CommitAsync(cancellationToken);
		}
		catch
		{
			await transaction.RollbackAsync(cancellationToken);
			throw;
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
			var currentTransaction = _db.Database.CurrentTransaction?.GetDbTransaction();
			if (currentTransaction != null)
			{
				cmd.Transaction = currentTransaction;
			}

			cmd.CommandText = "SELECT nextval('invoice_number_seq')";
			try
			{
				var result = await cmd.ExecuteScalarAsync(cancellationToken);
				var nextNumber = Convert.ToInt64(result);
				return string.Concat("INV-", currentYear.ToString(), "-", nextNumber.ToString("D6"));
			}
			catch
			{
				cmd.CommandText = "CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1 INCREMENT 1 MINVALUE 1 OWNED BY NONE; SELECT nextval('invoice_number_seq');";
				var result = await cmd.ExecuteScalarAsync(cancellationToken);
				var nextNumber = Convert.ToInt64(result);
				return string.Concat("INV-", currentYear.ToString(), "-", nextNumber.ToString("D6"));
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
			PaymentDate = request.PaymentDate ?? DateTime.UtcNow,
			CreatedAt = DateTime.UtcNow,
			IsDeleted = false
		};

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
			await transaction.CommitAsync(cancellationToken);
		}
		catch
		{
			await transaction.RollbackAsync(cancellationToken);
			throw;
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
}
