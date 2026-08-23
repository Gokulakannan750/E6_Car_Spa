using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

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
			query = query.Where(i => i.InvoiceNumber.ToLower().Contains(search)
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
			query = query.Where(i => i.InvoiceNumber.ToLower().Contains(search));
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
		.FirstOrDefaultAsync(i => i.JobCardId == jobCard.Id, cancellationToken);

		if (existingInvoice is not null)
			throw new InvalidOperationException($"An invoice already exists for this Job Card: {existingInvoice.InvoiceNumber}");

		var invoiceNumber = await GenerateInvoiceNumberAsync(cancellationToken);

		var now = DateTime.UtcNow;

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
			TaxableAmount = s.UnitPrice * s.Quantity,
			TaxAmount = Math.Round(s.UnitPrice * s.Quantity * s.TaxPercentage / 100, 2),
			TotalAmount = s.UnitPrice * s.Quantity + Math.Round(s.UnitPrice * s.Quantity * s.TaxPercentage / 100, 2) - s.DiscountAmount,
			CreatedAt = now,
			UpdatedAt = now,
			IsDeleted = false
		})
		.ToList();

		var subtotal = invoiceItems.Sum(i => i.UnitPrice * i.Quantity);
		var invoiceDiscount = 0m;
		var taxableAmount = subtotal - invoiceDiscount;
		var gstAmount = invoiceItems.Sum(i => i.TaxAmount);
		var totalAmount = taxableAmount + gstAmount;
		var paidAmount = 0m;
		var balanceAmount = totalAmount;

		var invoice = new Invoice
		{
			Id = Guid.NewGuid(),
			InvoiceNumber = invoiceNumber,
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
		.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

		if (invoice is null) return null;

		if (request.Discount.HasValue)
		{
			var newDiscount = request.Discount.Value;
			if (newDiscount < 0)
				throw new ArgumentOutOfRangeException(nameof(request.Discount), "Discount cannot be negative.");

			if (newDiscount > invoice.Subtotal)
				throw new ArgumentOutOfRangeException(nameof(request.Discount), "Discount cannot exceed subtotal.");

			invoice.Discount = newDiscount;
			invoice.TaxableAmount = invoice.Subtotal - newDiscount;
			invoice.TotalAmount = invoice.TaxableAmount + invoice.GstAmount;
			invoice.BalanceAmount = invoice.TotalAmount - invoice.PaidAmount;
		}

		if (request.Notes is not null)
			invoice.Notes = request.Notes;

		if (request.Status.HasValue)
			invoice.Status = request.Status.Value;

		invoice.UpdatedAt = DateTime.UtcNow;

		await _db.SaveChangesAsync(cancellationToken);

		await _db.Entry(invoice).Reference(i => i.Customer).LoadAsync(cancellationToken);
		await _db.Entry(invoice).Reference(i => i.Vehicle).LoadAsync(cancellationToken);
		await _db.Entry(invoice).Reference(i => i.JobCard).LoadAsync(cancellationToken);

		return ToDto(invoice);
	}

	private async Task<string> GenerateInvoiceNumberAsync(CancellationToken cancellationToken)
	{
		var currentYear = DateTime.UtcNow.Year;
		var conn = _db.Database.GetDbConnection();
		await conn.OpenAsync(cancellationToken);
		try
		{
			using var cmd = conn.CreateCommand();
			cmd.CommandText = "SELECT nextval('invoice_number_seq')";
			try
			{
				var result = await cmd.ExecuteScalarAsync(cancellationToken);
				var nextNumber = Convert.ToInt32(result);
				return string.Concat("INV-", currentYear.ToString(), "-", nextNumber.ToString("D6"));
			}
			catch
			{
				cmd.CommandText = "CREATE SEQUENCE invoice_number_seq START 1 INCREMENT 1 MINVALUE 1 OWNED BY NONE";
				await cmd.ExecuteNonQueryAsync(cancellationToken);

				cmd.CommandText = "SELECT nextval('invoice_number_seq')";
				var result = await cmd.ExecuteScalarAsync(cancellationToken);
				var nextNumber = Convert.ToInt32(result);
				return string.Concat("INV-", currentYear.ToString(), "-", nextNumber.ToString("D6"));
			}
		}
		finally
		{
			await conn.CloseAsync();
		}
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
