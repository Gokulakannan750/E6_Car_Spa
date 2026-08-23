using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using JCard = CarSpaManagement.Api.Domain.Entities.JobCard;
using JCardSvc = CarSpaManagement.Api.Domain.Entities.JobCardService;

namespace CarSpaManagement.Api.Application.Services;

public class JobCardService : IJobCardService
{
	private readonly AppDbContext _db;

	public JobCardService(AppDbContext db)
	{
		_db = db;
	}

	public async Task<JobCardDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
	{
		var jobCard = await _db.JobCards
			.Include(j => j.Customer)
			.Include(j => j.Vehicle)
			.Include(j => j.JobCardServices)
			.FirstOrDefaultAsync(j => j.Id == id, cancellationToken);

		if (jobCard is null) return null;

		var invoice = await _db.Invoices
			.Where(i => i.JobCardId == id && !i.IsDeleted)
			.Select(i => new { i.Id, i.InvoiceNumber, i.Status })
			.FirstOrDefaultAsync(cancellationToken);

		return ToDetailDto(jobCard, invoice?.Id, invoice?.InvoiceNumber, invoice?.Status.ToString());
	}

	public async Task<JobCardDto?> GetByNumberAsync(string jobCardNumber, CancellationToken cancellationToken = default)
	{
		var jobCard = await _db.JobCards
			.Include(j => j.Customer)
			.Include(j => j.Vehicle)
			.Include(j => j.JobCardServices)
			.FirstOrDefaultAsync(j => j.JobCardNumber == jobCardNumber, cancellationToken);

		if (jobCard is null) return null;

		var invoice = await _db.Invoices
			.Where(i => i.JobCardId == jobCard.Id && !i.IsDeleted)
			.Select(i => new { i.Id, i.InvoiceNumber, i.Status })
			.FirstOrDefaultAsync(cancellationToken);

		return ToDetailDto(jobCard, invoice?.Id, invoice?.InvoiceNumber, invoice?.Status.ToString());
	}

	public async Task<JobCardPrintDto?> GetForPrintAsync(Guid id, CancellationToken cancellationToken = default)
	{
		var jobCard = await _db.JobCards
			.Include(j => j.Customer)
			.Include(j => j.Vehicle)
			.Include(j => j.JobCardServices)
			.FirstOrDefaultAsync(j => j.Id == id, cancellationToken);

		if (jobCard is null) return null;

		return new JobCardPrintDto(
			jobCard.Id,
			jobCard.JobCardNumber,
			new CustomerSummaryDto(jobCard.Customer.Id, jobCard.Customer.Name, jobCard.Customer.PhoneNumber),
			new VehicleSummaryDto(jobCard.Vehicle.Id, jobCard.Vehicle.RegistrationNumber, jobCard.Vehicle.Make, jobCard.Vehicle.Model, jobCard.Vehicle.Variant, jobCard.Vehicle.Color),
			jobCard.Notes,
			jobCard.JobCardServices
				.Where(s => !s.IsDeleted)
				.OrderBy(s => s.CreatedAt)
				.Select(s => new JobCardServicePrintDto(s.Id, s.ServiceName, s.Quantity, s.UnitPrice))
				.ToList(),
			jobCard.CreatedAt);
	}

	public async Task<IReadOnlyList<JobCardListDto>> GetAllAsync(int page, int pageSize, JobCardStatus? status = null, Guid? customerId = null, Guid? vehicleId = null, string? search = null, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default)
	{
		var query = _db.JobCards
			.Include(j => j.Customer)
			.Include(j => j.Vehicle)
			.AsQueryable();

		if (status.HasValue) query = query.Where(j => j.Status == status.Value);
		if (customerId.HasValue) query = query.Where(j => j.CustomerId == customerId.Value);
		if (vehicleId.HasValue) query = query.Where(j => j.VehicleId == vehicleId.Value);
		if (fromDate.HasValue) query = query.Where(j => j.CreatedAt >= fromDate.Value);
		if (toDate.HasValue) query = query.Where(j => j.CreatedAt < toDate.Value.AddDays(1));

		if (!string.IsNullOrWhiteSpace(search))
		{
			search = search.Trim().ToLower();
			query = query.Where(j => j.JobCardNumber.ToLower().Contains(search)
				|| (j.Customer.Name != null && j.Customer.Name.ToLower().Contains(search))
				|| (j.Customer.PhoneNumber != null && j.Customer.PhoneNumber.Contains(search))
				|| (j.Vehicle.RegistrationNumber != null && j.Vehicle.RegistrationNumber.ToLower().Contains(search)));
		}

		var paged = await query.OrderByDescending(j => j.CreatedAt)
			.Skip((page - 1) * pageSize)
			.Take(pageSize)
			.Select(j => new {
				JobCard = j,
				Invoice = _db.Invoices.Where(i => i.JobCardId == j.Id && !i.IsDeleted).Select(i => new { i.Id, i.InvoiceNumber, i.Status }).FirstOrDefault()
			})
			.ToListAsync(cancellationToken);

		return paged.Select(x => new JobCardListDto(
			x.JobCard.Id,
			x.JobCard.JobCardNumber,
			x.JobCard.Customer.Name,
			x.JobCard.Customer.PhoneNumber,
			x.JobCard.Vehicle.RegistrationNumber,
			x.JobCard.Vehicle.Make,
			x.JobCard.Vehicle.Model,
			x.JobCard.Status,
			x.JobCard.TotalAmount,
			x.Invoice != null ? x.Invoice.Id : null,
			x.Invoice != null ? x.Invoice.InvoiceNumber : null,
			x.Invoice != null ? x.Invoice.Status.ToString() : null,
			x.JobCard.CreatedAt)).ToList();
	}

	public async Task<int> GetTotalCountAsync(JobCardStatus? status = null, Guid? customerId = null, Guid? vehicleId = null, string? search = null, DateTime? fromDate = null, DateTime? toDate = null, CancellationToken cancellationToken = default)
	{
		var query = _db.JobCards
			.Include(j => j.Customer)
			.Include(j => j.Vehicle)
			.AsQueryable();

		if (status.HasValue) query = query.Where(j => j.Status == status.Value);
		if (customerId.HasValue) query = query.Where(j => j.CustomerId == customerId.Value);
		if (vehicleId.HasValue) query = query.Where(j => j.VehicleId == vehicleId.Value);
		if (fromDate.HasValue) query = query.Where(j => j.CreatedAt >= fromDate.Value);
		if (toDate.HasValue) query = query.Where(j => j.CreatedAt < toDate.Value.AddDays(1));

		if (!string.IsNullOrWhiteSpace(search))
		{
			search = search.Trim().ToLower();
			query = query.Where(j => j.JobCardNumber.ToLower().Contains(search)
				|| (j.Customer.Name != null && j.Customer.Name.ToLower().Contains(search))
				|| (j.Customer.PhoneNumber != null && j.Customer.PhoneNumber.Contains(search))
				|| (j.Vehicle.RegistrationNumber != null && j.Vehicle.RegistrationNumber.ToLower().Contains(search)));
		}

		return await query.CountAsync(cancellationToken);
	}

	public async Task<IReadOnlyList<JobCardListDto>> GetByCustomerIdAsync(Guid customerId, int page, int pageSize, CancellationToken cancellationToken = default)
	{
		var paged = await _db.JobCards
			.Where(j => j.CustomerId == customerId)
			.OrderByDescending(j => j.CreatedAt)
			.Skip((page - 1) * pageSize)
			.Take(pageSize)
			.Select(j => new {
				JobCard = j,
				Invoice = _db.Invoices.Where(i => i.JobCardId == j.Id && !i.IsDeleted).Select(i => new { i.Id, i.InvoiceNumber, i.Status }).FirstOrDefault()
			})
			.ToListAsync(cancellationToken);

		return paged.Select(x => new JobCardListDto(
			x.JobCard.Id,
			x.JobCard.JobCardNumber,
			x.JobCard.Customer.Name,
			x.JobCard.Customer.PhoneNumber,
			x.JobCard.Vehicle.RegistrationNumber,
			x.JobCard.Vehicle.Make,
			x.JobCard.Vehicle.Model,
			x.JobCard.Status,
			x.JobCard.TotalAmount,
			x.Invoice != null ? x.Invoice.Id : null,
			x.Invoice != null ? x.Invoice.InvoiceNumber : null,
			x.Invoice != null ? x.Invoice.Status.ToString() : null,
			x.JobCard.CreatedAt)).ToList();
	}

	public async Task<IReadOnlyList<JobCardListDto>> GetByVehicleIdAsync(Guid vehicleId, int page, int pageSize, CancellationToken cancellationToken = default)
	{
		var paged = await _db.JobCards
			.Where(j => j.VehicleId == vehicleId)
			.OrderByDescending(j => j.CreatedAt)
			.Skip((page - 1) * pageSize)
			.Take(pageSize)
			.Select(j => new {
				JobCard = j,
				Invoice = _db.Invoices.Where(i => i.JobCardId == j.Id && !i.IsDeleted).Select(i => new { i.Id, i.InvoiceNumber, i.Status }).FirstOrDefault()
			})
			.ToListAsync(cancellationToken);

		return paged.Select(x => new JobCardListDto(
			x.JobCard.Id,
			x.JobCard.JobCardNumber,
			x.JobCard.Customer.Name,
			x.JobCard.Customer.PhoneNumber,
			x.JobCard.Vehicle.RegistrationNumber,
			x.JobCard.Vehicle.Make,
			x.JobCard.Vehicle.Model,
			x.JobCard.Status,
			x.JobCard.TotalAmount,
			x.Invoice != null ? x.Invoice.Id : null,
			x.Invoice != null ? x.Invoice.InvoiceNumber : null,
			x.Invoice != null ? x.Invoice.Status.ToString() : null,
			x.JobCard.CreatedAt)).ToList();
	}

	public async Task<JobCardDto> CreateAsync(CreateJobCardRequest request, CancellationToken cancellationToken = default)
	{
		var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId, cancellationToken);
		if (customer is null) throw new KeyNotFoundException("Customer not found.");

		var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v => v.Id == request.VehicleId, cancellationToken);
		if (vehicle is null) throw new KeyNotFoundException("Vehicle not found.");

		if (vehicle.CustomerId != request.CustomerId)
			throw new InvalidOperationException("The selected vehicle does not belong to the selected customer.");

		if (request.Services == null || !request.Services.Any())
			throw new ArgumentException("At least one service is required.", nameof(request.Services));

		var serviceIds = request.Services.Select(s => s.ServiceId).Distinct().ToList();
		var services = await _db.Services
		.Where(s => serviceIds.Contains(s.Id) && !s.IsDeleted)
		.ToListAsync(cancellationToken);

		if (services.Count != serviceIds.Count)
			throw new KeyNotFoundException("One or more services not found.");

		foreach (var svc in services)
		{
			if (!svc.IsActive)
				throw new InvalidOperationException($"Service '{svc.Name}' is inactive and cannot be used.");
		}

		var serviceMap = services.ToDictionary(s => s.Id);
		var combined = request.Services
		.GroupBy(s => s.ServiceId)
		.Select(g => new
		{
			ServiceId = g.Key,
			Quantity = g.Sum(x => x.Quantity),
			DiscountAmount = g.Sum(x => x.DiscountAmount)
		})
		.ToList();

		foreach (var item in combined)
		{
			if (item.Quantity <= 0)
				throw new ArgumentOutOfRangeException(nameof(item.Quantity), "Service quantity must be greater than zero.");

			if (item.DiscountAmount < 0)
				throw new ArgumentOutOfRangeException(nameof(item.DiscountAmount), "Discount amount cannot be negative.");
		}

		var jobCardNumber = await GenerateJobCardNumberAsync(cancellationToken);

		var now = DateTime.UtcNow;
		decimal subtotal = 0, taxAmount = 0, discountAmount = 0;

		var lineEntities = new List<JCardSvc>();

		foreach (var item in combined)
		{
			var svc = serviceMap[item.ServiceId];
			var baseAmount = svc.Price * item.Quantity;
			var effectiveTaxRate = request.IsGstEnabled ? svc.TaxPercentage : 0;
			var lineTax = Math.Round(baseAmount * effectiveTaxRate / 100, 2);
			var lineTotal = baseAmount + lineTax - item.DiscountAmount;

			subtotal += baseAmount;
			taxAmount += lineTax;
			discountAmount += item.DiscountAmount;

			lineEntities.Add(new JCardSvc
			{
				Id = Guid.NewGuid(),
				ServiceId = svc.Id,
				ServiceName = svc.Name,
				UnitPrice = svc.Price,
				Quantity = item.Quantity,
				TaxPercentage = effectiveTaxRate,
				DiscountAmount = item.DiscountAmount,
				LineTotal = lineTotal,
				CreatedAt = now,
				UpdatedAt = now,
				IsDeleted = false
			});
		}

		var totalAmount = subtotal + taxAmount - discountAmount;

		var jobCard = new JCard
		{
			Id = Guid.NewGuid(),
			JobCardNumber = jobCardNumber,
			CustomerId = request.CustomerId,
			VehicleId = request.VehicleId,
			Notes = request.Notes,
			Status = JobCardStatus.Draft,
			Subtotal = subtotal,
			TaxAmount = taxAmount,
			DiscountAmount = discountAmount,
			TotalAmount = totalAmount,
			CreatedAt = now,
			UpdatedAt = now,
			IsDeleted = false,
			JobCardServices = lineEntities
		};

		_db.JobCards.Add(jobCard);
		await _db.SaveChangesAsync(cancellationToken);

		await _db.Entry(jobCard).Reference(j => j.Customer).LoadAsync(cancellationToken);
		await _db.Entry(jobCard).Reference(j => j.Vehicle).LoadAsync(cancellationToken);

		return ToDetailDto(jobCard);
	}

	public async Task<JobCardDto?> UpdateServicesAsync(Guid id, UpdateJobCardServicesRequest request, CancellationToken cancellationToken = default)
	{
		var jobCard = await _db.JobCards
		.Include(j => j.JobCardServices)
		.FirstOrDefaultAsync(j => j.Id == id, cancellationToken);

		if (jobCard is null) return null;

		if (request.Services == null || !request.Services.Any())
			throw new ArgumentException("At least one service is required.", nameof(request.Services));

		var serviceIds = request.Services.Select(s => s.ServiceId).Distinct().ToList();
		var services = await _db.Services
		.Where(s => serviceIds.Contains(s.Id) && !s.IsDeleted)
		.ToListAsync(cancellationToken);

		if (services.Count != serviceIds.Count)
			throw new KeyNotFoundException("One or more services not found.");

		foreach (var svc in services)
		{
			if (!svc.IsActive)
				throw new InvalidOperationException($"Service '{svc.Name}' is inactive and cannot be used.");
		}

		var serviceMap = services.ToDictionary(s => s.Id);
		var combined = request.Services
		.GroupBy(s => s.ServiceId)
		.Select(g => new
		{
			ServiceId = g.Key,
			Quantity = g.Sum(x => x.Quantity),
			DiscountAmount = g.Sum(x => x.DiscountAmount)
		})
		.ToList();

		foreach (var item in combined)
		{
			if (item.Quantity <= 0)
				throw new ArgumentOutOfRangeException(nameof(item.Quantity), "Service quantity must be greater than zero.");

			if (item.DiscountAmount < 0)
				throw new ArgumentOutOfRangeException(nameof(item.DiscountAmount), "Discount amount cannot be negative.");
		}

		_db.JobCardServices.RemoveRange(jobCard.JobCardServices);

		var now = DateTime.UtcNow;
		decimal subtotal = 0, taxAmount = 0, discountAmount = 0;

		foreach (var item in combined)
		{
			var svc = serviceMap[item.ServiceId];
			var baseAmount = svc.Price * item.Quantity;
			var lineTax = Math.Round(baseAmount * svc.TaxPercentage / 100, 2);
			var lineTotal = baseAmount + lineTax - item.DiscountAmount;

			subtotal += baseAmount;
			taxAmount += lineTax;
			discountAmount += item.DiscountAmount;

			var newLine = new JCardSvc
			{
				Id = Guid.NewGuid(),
				JobCardId = jobCard.Id,
				ServiceId = svc.Id,
				ServiceName = svc.Name,
				UnitPrice = svc.Price,
				Quantity = item.Quantity,
				TaxPercentage = svc.TaxPercentage,
				DiscountAmount = item.DiscountAmount,
				LineTotal = lineTotal,
				CreatedAt = now,
				UpdatedAt = now,
				IsDeleted = false
			};
			_db.JobCardServices.Add(newLine);
		}

		jobCard.Subtotal = subtotal;
		jobCard.TaxAmount = taxAmount;
		jobCard.DiscountAmount = discountAmount;
		jobCard.TotalAmount = subtotal + taxAmount - discountAmount;
		jobCard.Notes = request.Notes;
		jobCard.UpdatedAt = now;

		await _db.SaveChangesAsync(cancellationToken);

		await _db.Entry(jobCard).Reference(j => j.Customer).LoadAsync(cancellationToken);
		await _db.Entry(jobCard).Reference(j => j.Vehicle).LoadAsync(cancellationToken);
		await _db.Entry(jobCard).Collection(j => j.JobCardServices).LoadAsync(cancellationToken);

		var invoice = await _db.Invoices
			.Where(i => i.JobCardId == jobCard.Id && !i.IsDeleted)
			.Select(i => new { i.Id, i.InvoiceNumber, i.Status })
			.FirstOrDefaultAsync(cancellationToken);

		return ToDetailDto(jobCard, invoice?.Id, invoice?.InvoiceNumber, invoice?.Status.ToString());
	}

	public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
	{
		var jobCard = await _db.JobCards.FindAsync([id], cancellationToken);
		if (jobCard is null) return false;

		jobCard.IsDeleted = true;
		jobCard.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync(cancellationToken);
		return true;
	}

	private async Task<string> GenerateJobCardNumberAsync(CancellationToken cancellationToken)
	{
		var currentYear = DateTime.UtcNow.Year;
		var conn = _db.Database.GetDbConnection();
		await conn.OpenAsync(cancellationToken);
		try
		{
			using var cmd = conn.CreateCommand();
			cmd.CommandText = "SELECT nextval('job_card_number_seq')";
			try
			{
				var result = await cmd.ExecuteScalarAsync(cancellationToken);
				var nextNumber = Convert.ToInt32(result);
				return string.Concat("JC-", currentYear.ToString(), "-", nextNumber.ToString("D6"));
			}
			catch
			{
				cmd.CommandText = "CREATE SEQUENCE job_card_number_seq START 1 INCREMENT 1 MINVALUE 1 OWNED BY NONE";
				await cmd.ExecuteNonQueryAsync(cancellationToken);

				cmd.CommandText = "SELECT nextval('job_card_number_seq')";
				var result = await cmd.ExecuteScalarAsync(cancellationToken);
				var nextNumber = Convert.ToInt32(result);
				return string.Concat("JC-", currentYear.ToString(), "-", nextNumber.ToString("D6"));
			}
		}
		finally
		{
			await conn.CloseAsync();
		}
	}

	private static JobCardDto ToDetailDto(JCard j, Guid? invoiceId = null, string? invoiceNumber = null, string? invoiceStatus = null) => new(
		j.Id,
		j.JobCardNumber,
		new CustomerSummaryDto(j.Customer.Id, j.Customer.Name, j.Customer.PhoneNumber),
		new VehicleSummaryDto(j.Vehicle.Id, j.Vehicle.RegistrationNumber, j.Vehicle.Make, j.Vehicle.Model, j.Vehicle.Variant, j.Vehicle.Color),
		j.Status,
		j.Notes,
		j.JobCardServices.Select(s => new JobCardServiceDto(
			s.Id,
			s.ServiceId,
			s.ServiceName,
			s.UnitPrice,
			s.Quantity,
			s.TaxPercentage,
			s.DiscountAmount,
			s.LineTotal)).ToList(),
		j.Subtotal,
		j.TaxAmount,
		j.DiscountAmount,
		j.TotalAmount,
		invoiceId,
		invoiceNumber,
		invoiceStatus,
		j.CreatedAt,
		j.UpdatedAt);

	private static JobCardListDto ToListDto(JCard j, Guid? invoiceId = null, string? invoiceNumber = null, string? invoiceStatus = null) => new(
		j.Id,
		j.JobCardNumber,
		j.Customer.Name,
		j.Customer.PhoneNumber,
		j.Vehicle.RegistrationNumber,
		j.Vehicle.Make,
		j.Vehicle.Model,
		j.Status,
		j.TotalAmount,
		invoiceId,
		invoiceNumber,
		invoiceStatus,
		j.CreatedAt);
}
