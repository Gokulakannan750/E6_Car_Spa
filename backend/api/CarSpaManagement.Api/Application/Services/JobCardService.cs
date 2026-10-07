using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.DTOs.OutsideJobs;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.Text.Json;
using JCard = CarSpaManagement.Api.Domain.Entities.JobCard;
using JCardSvc = CarSpaManagement.Api.Domain.Entities.JobCardService;

namespace CarSpaManagement.Api.Application.Services;

public class JobCardService : IJobCardService
{
	private readonly AppDbContext _db;
	private readonly IAuditLogService _auditLogService;
	private readonly IConfiguration? _configuration;

	public JobCardService(AppDbContext db, IAuditLogService auditLogService, IConfiguration? configuration = null)
	{
		_db = db;
		_auditLogService = auditLogService;
		_configuration = configuration;
	}

	public async Task<JobCardDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default, bool canViewOutsideJobs = false)
	{
		var query = _db.JobCards
			.Include(j => j.Customer)
			.Include(j => j.Vehicle)
			.Include(j => j.JobCardServices)
			.AsQueryable();

		if (canViewOutsideJobs)
		{
			query = query
				.Include(j => j.OutsideJobs)
					.ThenInclude(o => o.Vendor);
		}

		var jobCard = await query.FirstOrDefaultAsync(j => j.Id == id, cancellationToken);

		if (jobCard is null) return null;

		var invoice = await _db.Invoices
			.Where(i => i.JobCardId == id && !i.IsDeleted)
			.Select(i => new { i.Id, i.InvoiceNumber, i.Status })
			.FirstOrDefaultAsync(cancellationToken);

		return ToDetailDto(jobCard, invoice?.Id, invoice?.InvoiceNumber, invoice?.Status.ToString(), canViewOutsideJobs);
	}

	public async Task<JobCardDto?> GetByNumberAsync(string jobCardNumber, CancellationToken cancellationToken = default, bool canViewOutsideJobs = false)
	{
		var query = _db.JobCards
			.Include(j => j.Customer)
			.Include(j => j.Vehicle)
			.Include(j => j.JobCardServices)
			.AsQueryable();

		if (canViewOutsideJobs)
		{
			query = query
				.Include(j => j.OutsideJobs)
					.ThenInclude(o => o.Vendor);
		}

		var jobCard = await query.FirstOrDefaultAsync(j => j.JobCardNumber == jobCardNumber, cancellationToken);

		if (jobCard is null) return null;

		var invoice = await _db.Invoices
			.Where(i => i.JobCardId == jobCard.Id && !i.IsDeleted)
			.Select(i => new { i.Id, i.InvoiceNumber, i.Status })
			.FirstOrDefaultAsync(cancellationToken);

		return ToDetailDto(jobCard, invoice?.Id, invoice?.InvoiceNumber, invoice?.Status.ToString(), canViewOutsideJobs);
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

		var cardIds = paged.Select(x => x.JobCard.Id).ToList();
		var activeOutsideJobs = await _db.OutsideJobs
			.Include(o => o.Vendor)
			.Where(o => cardIds.Contains(o.JobCardId) && o.Status == OutsideJobStatus.Outside && !o.IsDeleted)
			.ToDictionaryAsync(o => o.JobCardId, cancellationToken);

		return paged.Select(x => {
			var activeJob = activeOutsideJobs.GetValueOrDefault(x.JobCard.Id);
			var location = BuildVehicleLocationDto(activeJob);
			return new JobCardListDto(
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
				x.JobCard.CreatedAt,
				location);
		}).ToList();
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
			.Include(j => j.Customer)
			.Include(j => j.Vehicle)
			.Where(j => j.CustomerId == customerId)
			.OrderByDescending(j => j.CreatedAt)
			.Skip((page - 1) * pageSize)
			.Take(pageSize)
			.Select(j => new {
				JobCard = j,
				Invoice = _db.Invoices.Where(i => i.JobCardId == j.Id && !i.IsDeleted).Select(i => new { i.Id, i.InvoiceNumber, i.Status }).FirstOrDefault()
			})
			.ToListAsync(cancellationToken);

		var cardIds = paged.Select(x => x.JobCard.Id).ToList();
		var activeOutsideJobs = await _db.OutsideJobs
			.Include(o => o.Vendor)
			.Where(o => cardIds.Contains(o.JobCardId) && o.Status == OutsideJobStatus.Outside && !o.IsDeleted)
			.ToDictionaryAsync(o => o.JobCardId, cancellationToken);

		return paged.Select(x => {
			var activeJob = activeOutsideJobs.GetValueOrDefault(x.JobCard.Id);
			var location = BuildVehicleLocationDto(activeJob);
			return new JobCardListDto(
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
				x.JobCard.CreatedAt,
				location);
		}).ToList();
	}

	public async Task<IReadOnlyList<JobCardListDto>> GetByVehicleIdAsync(Guid vehicleId, int page, int pageSize, CancellationToken cancellationToken = default)
	{
		var paged = await _db.JobCards
			.Include(j => j.Customer)
			.Include(j => j.Vehicle)
			.Where(j => j.VehicleId == vehicleId)
			.OrderByDescending(j => j.CreatedAt)
			.Skip((page - 1) * pageSize)
			.Take(pageSize)
			.Select(j => new {
				JobCard = j,
				Invoice = _db.Invoices.Where(i => i.JobCardId == j.Id && !i.IsDeleted).Select(i => new { i.Id, i.InvoiceNumber, i.Status }).FirstOrDefault()
			})
			.ToListAsync(cancellationToken);

		var cardIds = paged.Select(x => x.JobCard.Id).ToList();
		var activeOutsideJobs = await _db.OutsideJobs
			.Include(o => o.Vendor)
			.Where(o => cardIds.Contains(o.JobCardId) && o.Status == OutsideJobStatus.Outside && !o.IsDeleted)
			.ToDictionaryAsync(o => o.JobCardId, cancellationToken);

		return paged.Select(x => {
			var activeJob = activeOutsideJobs.GetValueOrDefault(x.JobCard.Id);
			var location = BuildVehicleLocationDto(activeJob);
			return new JobCardListDto(
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
				x.JobCard.CreatedAt,
				location);
		}).ToList();
	}

	public async Task<JobCardDto> CreateAsync(CreateJobCardRequest request, CancellationToken cancellationToken = default, bool canOverridePrice = false)
	{
		var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId, cancellationToken);
		if (customer is null) throw new KeyNotFoundException("Customer not found.");

		var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v => v.Id == request.VehicleId, cancellationToken);
		if (vehicle is null) throw new KeyNotFoundException("Vehicle not found.");

		if (vehicle.CustomerId != request.CustomerId)
			throw new InvalidOperationException("The selected vehicle does not belong to the selected customer.");

		var (combined, serviceMap) = await LoadServiceLinesAsync(request.Services, canOverridePrice, cancellationToken);

		var jobCardNumber = await GenerateJobCardNumberAsync(cancellationToken);

		var now = DateTime.UtcNow;
		decimal subtotal = 0, taxAmount = 0, discountAmount = 0;

		var lineEntities = new List<JCardSvc>();

		var calculation = InvoiceCalculator.Calculate(
			combined.Select(item => new InvoiceCalculator.LineInput(
				item.Quantity,
				item.UnitPrice,
				item.DiscountAmount,
				request.IsGstEnabled ? serviceMap[item.ServiceId].TaxPercentage : 0m)).ToList(),
			invoiceDiscount: 0m,
			isGstEnabled: true);

		for (var index = 0; index < combined.Count; index++)
		{
			var item = combined[index];
			var line = calculation.Lines[index];
			var svc = serviceMap[item.ServiceId];
			var effectiveTaxRate = request.IsGstEnabled ? svc.TaxPercentage : 0;

			subtotal += line.Gross;
			taxAmount += line.Tax;
			discountAmount += line.LineDiscount;

			lineEntities.Add(new JCardSvc
			{
				Id = Guid.NewGuid(),
				ServiceId = svc.Id,
				ServiceName = svc.Name,
				UnitPrice = item.UnitPrice,
				Quantity = item.Quantity,
				TaxPercentage = effectiveTaxRate,
				DiscountAmount = item.DiscountAmount,
				LineTotal = line.Total,
				CreatedAt = now,
				UpdatedAt = now,
				IsDeleted = false
			});
		}

		var totalAmount = calculation.Total;

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

		var priceOverrides = combined
			.Where(item => item.UnitPrice != serviceMap[item.ServiceId].Price)
			.Select(item => new
			{
				serviceId = item.ServiceId,
				serviceName = serviceMap[item.ServiceId].Name,
				cataloguePrice = serviceMap[item.ServiceId].Price,
				overriddenPrice = item.UnitPrice,
				priceDifference = item.UnitPrice - serviceMap[item.ServiceId].Price,
				quantity = item.Quantity
			})
			.ToList();

		var lineDiscounts = combined
			.Where(item => item.DiscountAmount > 0)
			.Select(item => new
			{
				serviceId = item.ServiceId,
				serviceName = serviceMap[item.ServiceId].Name,
				discountAmount = item.DiscountAmount,
				cataloguePrice = serviceMap[item.ServiceId].Price,
				unitPrice = item.UnitPrice,
				quantity = item.Quantity
			})
			.ToList();

		var servicesPayload = combined.Select(item => new
		{
			serviceId = item.ServiceId,
			serviceName = serviceMap[item.ServiceId].Name,
			quantity = item.Quantity,
			unitPrice = item.UnitPrice,
			discountAmount = item.DiscountAmount,
			cataloguePrice = serviceMap[item.ServiceId].Price,
			isPriceOverridden = item.UnitPrice != serviceMap[item.ServiceId].Price
		}).ToList();

		var newValuesObj = new
		{
			jobCardId = jobCard.Id,
			jobCardNumber = jobCard.JobCardNumber,
			customerId = jobCard.CustomerId,
			vehicleId = jobCard.VehicleId,
			subtotal = jobCard.Subtotal,
			taxAmount = jobCard.TaxAmount,
			discountAmount = jobCard.DiscountAmount,
			totalAmount = jobCard.TotalAmount,
			hasPriceOverrides = priceOverrides.Count > 0,
			priceOverrides,
			hasLineDiscounts = lineDiscounts.Count > 0,
			lineDiscounts,
			services = servicesPayload
		};

		await _auditLogService.RecordAsync(
			action: "jobcards.create",
			module: "JobCards",
			description: $"Job card '{jobCard.JobCardNumber}' created for vehicle '{jobCard.Vehicle?.RegistrationNumber}'. Total: ₹{jobCard.TotalAmount:F2}.",
			entityType: "JobCard",
			entityId: jobCard.Id,
			entityReference: jobCard.JobCardNumber,
			newValues: JsonSerializer.Serialize(newValuesObj),
			outcome: "Success",
			cancellationToken: cancellationToken);

		return ToDetailDto(jobCard);
	}

	/// <summary>
	/// Calculates a job-card estimate through the authoritative calculator without saving anything, using exactly the
	/// rules of <see cref="CreateAsync"/>. The New Job Card and edit-services screens display these values.
	/// </summary>
	public async Task<JobCardEstimateDto> PreviewAsync(PreviewJobCardRequest request, CancellationToken cancellationToken = default, bool canOverridePrice = false)
	{
		var (combined, serviceMap) = await LoadServiceLinesAsync(request.Services, canOverridePrice, cancellationToken);

		var rates = combined.Select(item => request.IsGstEnabled ? serviceMap[item.ServiceId].TaxPercentage : 0m).ToList();
		var calculation = InvoiceCalculator.Calculate(
			combined.Select((item, index) => new InvoiceCalculator.LineInput(
				item.Quantity, item.UnitPrice, item.DiscountAmount, rates[index])).ToList(),
			invoiceDiscount: 0m,
			isGstEnabled: true);

		var lines = combined.Select((item, index) =>
		{
			var line = calculation.Lines[index];
			var svc = serviceMap[item.ServiceId];
			return new JobCardEstimateLineDto(svc.Id, svc.Name, item.Quantity, item.UnitPrice, line.LineDiscount, rates[index], line.Taxable, line.Tax, line.Total);
		}).ToList();

		var breakdown = request.IsGstEnabled
			? InvoiceCalculator.SummarizeByRate(lines.Select(l => ((decimal?)l.TaxRatePercent, l.TaxableAmount, l.TaxAmount)))
				.Select(g => new TaxBreakdownDto(g.RatePercent, g.Taxable, g.Cgst, g.Sgst, g.Tax))
				.ToList()
			: [];

		return new JobCardEstimateDto(
			lines,
			calculation.Lines.Sum(l => l.Gross),
			calculation.Lines.Sum(l => l.LineDiscount),
			calculation.Taxable,
			calculation.Cgst,
			calculation.Sgst,
			calculation.GstAmount,
			calculation.Total,
			breakdown);
	}

	/// <summary>Validates requested job-card services and merges repeated services into one line each.</summary>
	private async Task<(List<(Guid ServiceId, int Quantity, decimal DiscountAmount, decimal UnitPrice)> Lines, Dictionary<Guid, Domain.Entities.Service> ServiceMap)>
		LoadServiceLinesAsync(IReadOnlyCollection<JobCardServiceItemRequest>? requested, bool canOverridePrice, CancellationToken cancellationToken)
	{
		if (requested == null || requested.Count == 0)
			throw new ArgumentException("At least one service is required.", nameof(requested));

		var serviceIds = requested.Select(s => s.ServiceId).Distinct().ToList();
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

		foreach (var item in requested)
		{
			var svc = serviceMap[item.ServiceId];
			if (item.UnitPrice.HasValue && item.UnitPrice.Value != svc.Price)
			{
				if (!canOverridePrice)
				{
					throw new ForbiddenException($"Overriding catalogue price for service '{svc.Name}' requires the 'invoices.price_override' permission.");
				}
			}
		}

		var combined = requested
			.GroupBy(s => s.ServiceId)
			.Select(g => (
				ServiceId: g.Key,
				Quantity: g.Sum(x => x.Quantity),
				DiscountAmount: g.Sum(x => x.DiscountAmount),
				UnitPrice: g.FirstOrDefault(x => x.UnitPrice.HasValue)?.UnitPrice ?? serviceMap[g.Key].Price
			))
			.ToList();

		foreach (var item in combined)
		{
			if (item.Quantity <= 0)
				throw new ArgumentOutOfRangeException(nameof(item.Quantity), "Service quantity must be greater than zero.");

			if (item.DiscountAmount < 0)
				throw new ArgumentOutOfRangeException(nameof(item.DiscountAmount), "Discount amount cannot be negative.");
		}

		return (combined, serviceMap);
	}

	public async Task<JobCardDto?> UpdateServicesAsync(Guid id, UpdateJobCardServicesRequest request, CancellationToken cancellationToken = default, bool canOverridePrice = false)
	{
		var jobCard = await _db.JobCards
			.Include(j => j.JobCardServices)
			.FirstOrDefaultAsync(j => j.Id == id, cancellationToken);

		if (jobCard is null) return null;

		await EnsureJobCardNotLockedAsync(id, jobCard, cancellationToken);

		var (combined, serviceMap) = await LoadServiceLinesAsync(request.Services, canOverridePrice, cancellationToken);

		var existingLines = jobCard.JobCardServices.Select(s => new
		{
			serviceId = s.ServiceId,
			serviceName = s.ServiceName,
			quantity = s.Quantity,
			unitPrice = s.UnitPrice,
			discountAmount = s.DiscountAmount,
			lineTotal = s.LineTotal
		}).ToList();

		var oldValuesObj = new
		{
			jobCardId = jobCard.Id,
			jobCardNumber = jobCard.JobCardNumber,
			subtotal = jobCard.Subtotal,
			taxAmount = jobCard.TaxAmount,
			discountAmount = jobCard.DiscountAmount,
			totalAmount = jobCard.TotalAmount,
			services = existingLines
		};

		_db.JobCardServices.RemoveRange(jobCard.JobCardServices);

		var now = DateTime.UtcNow;
		decimal subtotal = 0, taxAmount = 0, discountAmount = 0;

		var calculation = InvoiceCalculator.Calculate(
			combined.Select(item => new InvoiceCalculator.LineInput(
				item.Quantity,
				item.UnitPrice,
				item.DiscountAmount,
				serviceMap[item.ServiceId].TaxPercentage)).ToList(),
			invoiceDiscount: 0m,
			isGstEnabled: true);

		for (var index = 0; index < combined.Count; index++)
		{
			var item = combined[index];
			var line = calculation.Lines[index];
			var svc = serviceMap[item.ServiceId];
			var lineTotal = line.Total;

			subtotal += line.Gross;
			taxAmount += line.Tax;
			discountAmount += line.LineDiscount;

			var newLine = new JCardSvc
			{
				Id = Guid.NewGuid(),
				JobCardId = jobCard.Id,
				ServiceId = svc.Id,
				ServiceName = svc.Name,
				UnitPrice = item.UnitPrice,
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
		jobCard.TotalAmount = calculation.Total;
		jobCard.Notes = request.Notes;
		jobCard.UpdatedAt = now;

		await _db.SaveChangesAsync(cancellationToken);

		await _db.Entry(jobCard).Reference(j => j.Customer).LoadAsync(cancellationToken);
		await _db.Entry(jobCard).Reference(j => j.Vehicle).LoadAsync(cancellationToken);
		await _db.Entry(jobCard).Collection(j => j.JobCardServices).LoadAsync(cancellationToken);

		var priceOverrides = combined
			.Where(item => item.UnitPrice != serviceMap[item.ServiceId].Price)
			.Select(item => new
			{
				serviceId = item.ServiceId,
				serviceName = serviceMap[item.ServiceId].Name,
				cataloguePrice = serviceMap[item.ServiceId].Price,
				overriddenPrice = item.UnitPrice,
				priceDifference = item.UnitPrice - serviceMap[item.ServiceId].Price,
				quantity = item.Quantity
			})
			.ToList();

		var lineDiscounts = combined
			.Where(item => item.DiscountAmount > 0)
			.Select(item => new
			{
				serviceId = item.ServiceId,
				serviceName = serviceMap[item.ServiceId].Name,
				discountAmount = item.DiscountAmount,
				cataloguePrice = serviceMap[item.ServiceId].Price,
				unitPrice = item.UnitPrice,
				quantity = item.Quantity
			})
			.ToList();

		var newServicesPayload = combined.Select(item =>
		{
			var svc = serviceMap[item.ServiceId];
			var oldLine = existingLines.FirstOrDefault(o => o.serviceId == item.ServiceId);
			return new
			{
				serviceId = item.ServiceId,
				serviceName = svc.Name,
				quantity = item.Quantity,
				unitPrice = item.UnitPrice,
				discountAmount = item.DiscountAmount,
				cataloguePrice = svc.Price,
				oldPrice = oldLine?.unitPrice,
				isPriceOverridden = item.UnitPrice != svc.Price
			};
		}).ToList();

		var newValuesObj = new
		{
			jobCardId = jobCard.Id,
			jobCardNumber = jobCard.JobCardNumber,
			subtotal = jobCard.Subtotal,
			taxAmount = jobCard.TaxAmount,
			discountAmount = jobCard.DiscountAmount,
			totalAmount = jobCard.TotalAmount,
			hasPriceOverrides = priceOverrides.Count > 0,
			priceOverrides,
			hasLineDiscounts = lineDiscounts.Count > 0,
			lineDiscounts,
			services = newServicesPayload
		};

		await _auditLogService.RecordAsync(
			action: "jobcards.edit",
			module: "JobCards",
			description: $"Job card '{jobCard.JobCardNumber}' services updated. Total: ₹{jobCard.TotalAmount:F2}.",
			entityType: "JobCard",
			entityId: jobCard.Id,
			entityReference: jobCard.JobCardNumber,
			oldValues: JsonSerializer.Serialize(oldValuesObj),
			newValues: JsonSerializer.Serialize(newValuesObj),
			outcome: "Success",
			cancellationToken: cancellationToken);

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

		await EnsureJobCardNotLockedAsync(id, jobCard, cancellationToken);

		jobCard.IsDeleted = true;
		jobCard.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: "jobcards.delete",
			module: "JobCards",
			description: $"Job card '{jobCard.JobCardNumber}' deleted.",
			entityType: "JobCard",
			entityId: jobCard.Id,
			entityReference: jobCard.JobCardNumber,
			outcome: "Success",
			cancellationToken: cancellationToken);

		return true;
	}

	private async Task EnsureJobCardNotLockedAsync(Guid jobCardId, JCard? existingJobCard = null, CancellationToken cancellationToken = default)
	{
		if (existingJobCard != null && (existingJobCard.Status == JobCardStatus.Invoiced ||
		                                existingJobCard.Status == JobCardStatus.Paid ||
		                                existingJobCard.Status == JobCardStatus.Delivered))
		{
			throw new ConflictException("This job card is locked because its invoice has already been generated.");
		}

		var isLocked = await _db.Invoices.AnyAsync(
			i => i.JobCardId == jobCardId &&
			     !i.IsDeleted &&
			     (!string.IsNullOrEmpty(i.InvoiceNumber) || i.Status != InvoiceStatus.Draft),
			cancellationToken);

		if (isLocked)
		{
			throw new ConflictException("This job card is locked because its invoice has already been generated.");
		}
	}

	private async Task<string> GenerateJobCardNumberAsync(CancellationToken cancellationToken)
	{
		var currentYear = DateTime.UtcNow.Year;
		var configuredPrefix = _configuration?["JobCard:Prefix"]?.Trim();
		var prefix = !string.IsNullOrWhiteSpace(configuredPrefix) ? configuredPrefix : "JC";

		if (!_db.Database.IsRelational())
		{
			var count = await _db.JobCards.CountAsync(cancellationToken) + 1;
			return $"{prefix}-{currentYear}-{count:D6}";
		}

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
			var currentTx = _db.Database.CurrentTransaction?.GetDbTransaction();
			if (currentTx != null) cmd.Transaction = currentTx;

			while (true)
			{
				cmd.CommandText = "SELECT nextval('job_card_number_seq')";
				long nextNumber;
				try
				{
					var result = await cmd.ExecuteScalarAsync(cancellationToken);
					nextNumber = Convert.ToInt64(result);
				}
				catch
				{
					cmd.CommandText = "CREATE SEQUENCE IF NOT EXISTS job_card_number_seq START 1 INCREMENT 1 MINVALUE 1 OWNED BY NONE; SELECT nextval('job_card_number_seq');";
					var result = await cmd.ExecuteScalarAsync(cancellationToken);
					nextNumber = Convert.ToInt64(result);
				}

				var candidate = string.Concat(prefix, "-", currentYear.ToString(), "-", nextNumber.ToString("D6"));
				var exists = await _db.JobCards.AnyAsync(j => j.JobCardNumber == candidate, cancellationToken);
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

	private static VehicleLocationDto BuildVehicleLocationDto(OutsideJob? activeJob)
	{
		if (activeJob == null)
		{
			return new VehicleLocationDto(
				Location: "At Showroom",
				IsOutside: false,
				ActiveOutsideJobId: null,
				VendorId: null,
				VendorName: null,
				ServiceName: null,
				SentAt: null,
				ExpectedReturnAt: null,
				IsOverdue: false);
		}

		var isOverdue = DateTime.UtcNow > activeJob.ExpectedReturnAt;
		return new VehicleLocationDto(
			Location: "At Outside Shop",
			IsOutside: true,
			ActiveOutsideJobId: activeJob.Id,
			VendorId: activeJob.VendorId,
			VendorName: activeJob.Vendor?.Name ?? string.Empty,
			ServiceName: activeJob.ServiceName,
			SentAt: activeJob.SentAt,
			ExpectedReturnAt: activeJob.ExpectedReturnAt,
			IsOverdue: isOverdue);
	}

	private static JobCardDto ToDetailDto(JCard j, Guid? invoiceId = null, string? invoiceNumber = null, string? invoiceStatus = null, bool canViewOutsideJobs = false)
	{
		var activeJob = canViewOutsideJobs
			? j.OutsideJobs?.FirstOrDefault(o => o.Status == OutsideJobStatus.Outside && !o.IsDeleted)
			: null;
		var vehicleLocation = BuildVehicleLocationDto(activeJob);

		var outsideJobDtos = canViewOutsideJobs && j.OutsideJobs != null
			? j.OutsideJobs
				.Where(o => !o.IsDeleted)
				.OrderByDescending(o => o.SentAt)
				.Select(o => new OutsideJobDto(
					Id: o.Id,
					JobCardId: o.JobCardId,
					JobCardNumber: j.JobCardNumber,
					VehicleId: j.Vehicle.Id,
					VehicleRegistrationNumber: j.Vehicle.RegistrationNumber,
					VehicleMake: j.Vehicle.Make,
					VehicleModel: j.Vehicle.Model,
					CustomerId: j.Customer.Id,
					CustomerName: j.Customer.Name,
					CustomerPhone: j.Customer.PhoneNumber,
					VendorId: o.VendorId,
					VendorName: o.Vendor?.Name ?? string.Empty,
					VendorPhone: o.Vendor?.Phone,
					ServiceId: o.ServiceId,
					ServiceName: o.ServiceName,
					Status: o.Status,
					StatusName: o.Status.ToString(),
					SentAt: o.SentAt,
					ExpectedReturnAt: o.ExpectedReturnAt,
					ReturnedAt: o.ReturnedAt,
					IsOverdue: o.Status == OutsideJobStatus.Outside && DateTime.UtcNow > o.ExpectedReturnAt,
					SentByUserId: o.SentByUserId,
					SentByUserName: o.SentByUserName,
					ReturnedByUserId: o.ReturnedByUserId,
					ReturnedByUserName: o.ReturnedByUserName,
					VendorCost: o.VendorCost,
					Notes: o.Notes,
					ReturnNotes: o.ReturnNotes,
					CancellationReason: o.CancellationReason,
					CreatedAt: o.CreatedAt,
					UpdatedAt: o.UpdatedAt))
				.ToList()
			: null;

		return new(
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
			j.UpdatedAt,
			vehicleLocation,
			outsideJobDtos);
	}

	private static JobCardListDto ToListDto(JCard j, Guid? invoiceId = null, string? invoiceNumber = null, string? invoiceStatus = null, VehicleLocationDto? vehicleLocation = null) => new(
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
		j.CreatedAt,
		vehicleLocation);
}
