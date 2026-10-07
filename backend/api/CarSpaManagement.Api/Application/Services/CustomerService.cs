using CarSpaManagement.Api.Application.DTOs.Customers;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public class CustomerService : ICustomerService
{
	private readonly AppDbContext _db;
	private readonly IAuditLogService _auditLogService;

	public CustomerService(AppDbContext db, IAuditLogService auditLogService)
	{
		_db = db;
		_auditLogService = auditLogService;
	}

	public async Task<CustomerDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
	{
		return await ProjectCustomerDtoQuery(_db.Customers.Where(x => x.Id == id)).FirstOrDefaultAsync(cancellationToken);
	}

	public async Task<CustomerDto?> GetByPhoneAsync(string phoneNumber, CancellationToken cancellationToken = default)
	{
		if (string.IsNullOrWhiteSpace(phoneNumber)) return null;

		var digits = new string(phoneNumber.Where(char.IsDigit).ToArray());
		if (digits.Length == 0) return null;

		var baseQuery = _db.Customers.Where(x => x.PhoneNumber == phoneNumber.Trim());
		var c = await ProjectCustomerDtoQuery(baseQuery).FirstOrDefaultAsync(cancellationToken);

		if (c is not null) return c;

		baseQuery = _db.Customers.Where(x => x.PhoneNumber.Contains(digits));
		return await ProjectCustomerDtoQuery(baseQuery).FirstOrDefaultAsync(cancellationToken);
	}

	public async Task<CustomerDto?> GetByRegistrationAsync(string registrationNumber, CancellationToken cancellationToken = default)
	{
		var reg = VehicleService.NormalizeRegistration(registrationNumber);
		if (string.IsNullOrEmpty(reg)) return null;

		var customerId = await _db.Vehicles
			.Where(v => v.RegistrationNumber == reg)
			.Select(v => (Guid?)v.CustomerId)
			.FirstOrDefaultAsync(cancellationToken);

		if (!customerId.HasValue) return null;

		return await GetByIdAsync(customerId.Value, cancellationToken);
	}

	public async Task<IReadOnlyList<CustomerDto>> GetAllAsync(int page, int pageSize, string? search = null, string? paymentStatus = null, CancellationToken cancellationToken = default)
	{
		var query = _db.Customers.AsQueryable();

		if (!string.IsNullOrWhiteSpace(search))
		{
			search = search.Trim().ToLower();
			query = query.Where(c => c.Name.ToLower().Contains(search) || c.PhoneNumber.Contains(search) || (c.Email != null && c.Email.ToLower().Contains(search)) || c.Vehicles.Any(v => v.RegistrationNumber.ToLower().Contains(search)));
		}

		var customerSummaries = query.Select(c => new
		{
			Customer = c,
			VehicleCount = c.Vehicles.Count,
			JobCardCount = c.JobCards.Count,
			TotalRevenue = c.JobCards.Sum(j => j.TotalAmount),
			VehicleRegistrationNumbers = c.Vehicles.Select(v => v.RegistrationNumber).ToList(),
			InvoiceCount = _db.Invoices.Count(i => i.CustomerId == c.Id && !i.IsDeleted && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled),
			TotalInvoicedAmount = _db.Invoices
				.Where(i => i.CustomerId == c.Id && !i.IsDeleted && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled)
				.Sum(i => (decimal?)i.TotalAmount) ?? 0m,
			TotalPaidAmount = _db.Invoices
				.Where(i => i.CustomerId == c.Id && !i.IsDeleted && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled)
				.Sum(i => (decimal?)i.PaidAmount) ?? 0m,
			TotalOutstandingAmount = _db.Invoices
				.Where(i => i.CustomerId == c.Id && !i.IsDeleted && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled)
				.Sum(i => (decimal?)i.BalanceAmount) ?? 0m,
			HasUnpaidInvoice = _db.Invoices
				.Any(i => i.CustomerId == c.Id && !i.IsDeleted && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled && i.BalanceAmount > 0 && i.PaidAmount == 0)
		});

		if (!string.IsNullOrWhiteSpace(paymentStatus) && !paymentStatus.Equals("all", StringComparison.OrdinalIgnoreCase))
		{
			var status = paymentStatus.Trim().ToLowerInvariant();
			if (status == "no invoices" || status == "no-invoices" || status == "noinvoices")
			{
				customerSummaries = customerSummaries.Where(x => x.InvoiceCount == 0);
			}
			else if (status == "paid")
			{
				customerSummaries = customerSummaries.Where(x => x.InvoiceCount > 0 && x.TotalOutstandingAmount <= 0m);
			}
			else if (status == "payment due" || status == "payment-due" || status == "due")
			{
				customerSummaries = customerSummaries.Where(x => x.InvoiceCount > 0 && x.TotalOutstandingAmount > 0m && x.HasUnpaidInvoice);
			}
			else if (status == "payment pending" || status == "payment-pending" || status == "pending" || status == "partially paid" || status == "partially-paid")
			{
				customerSummaries = customerSummaries.Where(x => x.InvoiceCount > 0 && x.TotalOutstandingAmount > 0m && !x.HasUnpaidInvoice);
			}
		}

		var items = await customerSummaries
			.OrderByDescending(x => x.Customer.CreatedAt)
			.Skip((page - 1) * pageSize)
			.Take(pageSize)
			.ToListAsync(cancellationToken);

		return items.Select(x => new CustomerDto(
			x.Customer.Id,
			x.Customer.Name,
			x.Customer.PhoneNumber,
			x.Customer.Email,
			x.Customer.Address,
			x.Customer.CreatedAt,
			x.VehicleCount,
			x.JobCardCount,
			x.TotalRevenue,
			x.VehicleRegistrationNumbers,
			x.InvoiceCount,
			x.TotalInvoicedAmount,
			x.TotalPaidAmount,
			x.TotalOutstandingAmount,
			CalculatePaymentStatus(x.InvoiceCount, x.TotalOutstandingAmount, x.HasUnpaidInvoice),
			x.Customer.WhatsAppConsent,
			x.Customer.WhatsAppConsentUpdatedAtUtc
		)).ToList();
	}

	public async Task<int> GetTotalCountAsync(string? search = null, string? paymentStatus = null, CancellationToken cancellationToken = default)
	{
		var query = _db.Customers.AsQueryable();
		if (!string.IsNullOrWhiteSpace(search))
		{
			search = search.Trim().ToLower();
			query = query.Where(c => c.Name.ToLower().Contains(search) || c.PhoneNumber.Contains(search) || (c.Email != null && c.Email.ToLower().Contains(search)) || c.Vehicles.Any(v => v.RegistrationNumber.ToLower().Contains(search)));
		}

		if (string.IsNullOrWhiteSpace(paymentStatus) || paymentStatus.Equals("all", StringComparison.OrdinalIgnoreCase))
		{
			return await query.CountAsync(cancellationToken);
		}

		var customerSummaries = query.Select(c => new
		{
			InvoiceCount = _db.Invoices.Count(i => i.CustomerId == c.Id && !i.IsDeleted && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled),
			TotalOutstandingAmount = _db.Invoices
				.Where(i => i.CustomerId == c.Id && !i.IsDeleted && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled)
				.Sum(i => (decimal?)i.BalanceAmount) ?? 0m,
			HasUnpaidInvoice = _db.Invoices
				.Any(i => i.CustomerId == c.Id && !i.IsDeleted && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled && i.BalanceAmount > 0 && i.PaidAmount == 0)
		});

		var status = paymentStatus.Trim().ToLowerInvariant();
		if (status == "no invoices" || status == "no-invoices" || status == "noinvoices")
		{
			customerSummaries = customerSummaries.Where(x => x.InvoiceCount == 0);
		}
		else if (status == "paid")
		{
			customerSummaries = customerSummaries.Where(x => x.InvoiceCount > 0 && x.TotalOutstandingAmount <= 0m);
		}
		else if (status == "payment due" || status == "payment-due" || status == "due")
		{
			customerSummaries = customerSummaries.Where(x => x.InvoiceCount > 0 && x.TotalOutstandingAmount > 0m && x.HasUnpaidInvoice);
		}
		else if (status == "payment pending" || status == "payment-pending" || status == "pending" || status == "partially paid" || status == "partially-paid")
		{
			customerSummaries = customerSummaries.Where(x => x.InvoiceCount > 0 && x.TotalOutstandingAmount > 0m && !x.HasUnpaidInvoice);
		}

		return await customerSummaries.CountAsync(cancellationToken);
	}

	private static string CalculatePaymentStatus(int invoiceCount, decimal totalOutstandingAmount, bool hasUnpaidInvoice)
	{
		if (invoiceCount == 0) return "No Invoices";
		if (totalOutstandingAmount <= 0m) return "Paid";
		if (hasUnpaidInvoice) return "Payment Due";
		return "Payment Pending";
	}

	private IQueryable<CustomerDto> ProjectCustomerDtoQuery(IQueryable<Customer> query)
	{
		return query.Select(x => new
		{
			Customer = x,
			VehicleCount = x.Vehicles.Count,
			JobCardCount = x.JobCards.Count,
			TotalRevenue = x.JobCards.Sum(j => j.TotalAmount),
			VehicleRegistrationNumbers = x.Vehicles.Select(v => v.RegistrationNumber).ToList(),
			InvoiceCount = _db.Invoices.Count(i => i.CustomerId == x.Id && !i.IsDeleted && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled),
			TotalInvoicedAmount = _db.Invoices
				.Where(i => i.CustomerId == x.Id && !i.IsDeleted && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled)
				.Sum(i => (decimal?)i.TotalAmount) ?? 0m,
			TotalPaidAmount = _db.Invoices
				.Where(i => i.CustomerId == x.Id && !i.IsDeleted && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled)
				.Sum(i => (decimal?)i.PaidAmount) ?? 0m,
			TotalOutstandingAmount = _db.Invoices
				.Where(i => i.CustomerId == x.Id && !i.IsDeleted && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled)
				.Sum(i => (decimal?)i.BalanceAmount) ?? 0m,
			HasUnpaidInvoice = _db.Invoices
				.Any(i => i.CustomerId == x.Id && !i.IsDeleted && i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled && i.BalanceAmount > 0 && i.PaidAmount == 0)
		}).Select(c => new CustomerDto(
			c.Customer.Id,
			c.Customer.Name,
			c.Customer.PhoneNumber,
			c.Customer.Email,
			c.Customer.Address,
			c.Customer.CreatedAt,
			c.VehicleCount,
			c.JobCardCount,
			c.TotalRevenue,
			c.VehicleRegistrationNumbers,
			c.InvoiceCount,
			c.TotalInvoicedAmount,
			c.TotalPaidAmount,
			c.TotalOutstandingAmount,
			CalculatePaymentStatus(c.InvoiceCount, c.TotalOutstandingAmount, c.HasUnpaidInvoice),
			c.Customer.WhatsAppConsent,
			c.Customer.WhatsAppConsentUpdatedAtUtc
		));
	}

	public async Task<CustomerDto> CreateAsync(CreateCustomerRequest request, CancellationToken cancellationToken = default, Guid? actingUserId = null)
	{
		var customer = new Customer
		{
			Name = request.Name.Trim(),
			PhoneNumber = request.PhoneNumber.Trim(),
			Email = request.Email?.Trim(),
			Address = request.Address?.Trim()
		};

		var consentGiven = request.WhatsAppConsent == true;
		if (consentGiven)
		{
			customer.WhatsAppConsent = true;
			customer.WhatsAppConsentUpdatedAtUtc = DateTime.UtcNow;
			customer.WhatsAppConsentUpdatedByUserId = actingUserId;
		}

		await _db.Customers.AddAsync(customer, cancellationToken);
		await _db.SaveChangesAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: "customers.create",
			module: "Customers",
			description: $"Customer '{customer.Name}' created with phone '{customer.PhoneNumber}'.",
			entityType: "Customer",
			entityId: customer.Id,
			entityReference: customer.Name,
			outcome: "Success",
			cancellationToken: cancellationToken);

		if (consentGiven)
		{
			await RecordConsentChangeAsync(customer, previousConsent: false, actingUserId, cancellationToken);
		}

		return new CustomerDto(customer.Id, customer.Name, customer.PhoneNumber, customer.Email, customer.Address, customer.CreatedAt, 0, 0, 0,
			WhatsAppConsent: customer.WhatsAppConsent, WhatsAppConsentUpdatedAtUtc: customer.WhatsAppConsentUpdatedAtUtc);
	}

	public async Task<CustomerDto?> UpdateAsync(Guid id, UpdateCustomerRequest request, CancellationToken cancellationToken = default, Guid? actingUserId = null)
	{
		var customer = await _db.Customers.FindAsync([id], cancellationToken);
		if (customer is null) return null;

		var previousConsent = customer.WhatsAppConsent;
		var consentChanged = request.WhatsAppConsent.HasValue && request.WhatsAppConsent.Value != previousConsent;

		customer.Name = request.Name.Trim();
		customer.PhoneNumber = request.PhoneNumber.Trim();
		customer.Email = request.Email?.Trim();
		customer.Address = request.Address?.Trim();
		customer.UpdatedAt = DateTime.UtcNow;

		if (consentChanged)
		{
			customer.WhatsAppConsent = request.WhatsAppConsent!.Value;
			customer.WhatsAppConsentUpdatedAtUtc = DateTime.UtcNow;
			customer.WhatsAppConsentUpdatedByUserId = actingUserId;
		}

		await _db.SaveChangesAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: "customers.edit",
			module: "Customers",
			description: $"Customer '{customer.Name}' updated.",
			entityType: "Customer",
			entityId: customer.Id,
			entityReference: customer.Name,
			outcome: "Success",
			cancellationToken: cancellationToken);

		if (consentChanged)
		{
			await RecordConsentChangeAsync(customer, previousConsent, actingUserId, cancellationToken);
		}

		return await GetByIdAsync(id, cancellationToken);
	}

	/// <summary>Writes a dedicated audit entry for every WhatsApp consent change: who, when, old and new value.</summary>
	private Task RecordConsentChangeAsync(Customer customer, bool previousConsent, Guid? actingUserId, CancellationToken cancellationToken)
	{
		return _auditLogService.RecordAsync(
			action: AuditActions.CustomerWhatsAppConsentChanged,
			module: AuditModules.Customers,
			description: customer.WhatsAppConsent
				? $"WhatsApp consent recorded for customer '{customer.Name}'."
				: $"WhatsApp consent withdrawn for customer '{customer.Name}'.",
			entityType: "Customer",
			entityId: customer.Id,
			entityReference: customer.Name,
			userId: actingUserId,
			oldValues: System.Text.Json.JsonSerializer.Serialize(new { whatsAppConsent = previousConsent }),
			newValues: System.Text.Json.JsonSerializer.Serialize(new { whatsAppConsent = customer.WhatsAppConsent, changedAtUtc = customer.WhatsAppConsentUpdatedAtUtc }),
			outcome: "Success",
			cancellationToken: cancellationToken);
	}

	public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
	{
		var customer = await _db.Customers.FindAsync([id], cancellationToken);
		if (customer is null) return false;

		customer.IsDeleted = true;
		customer.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: "customers.delete",
			module: "Customers",
			description: $"Customer '{customer.Name}' deleted.",
			entityType: "Customer",
			entityId: customer.Id,
			entityReference: customer.Name,
			outcome: "Success",
			cancellationToken: cancellationToken);

		return true;
	}

	public async Task<bool> PhoneExistsAsync(string phoneNumber, Guid? excludeId = null, CancellationToken cancellationToken = default)
	{
		var query = _db.Customers.Where(c => c.PhoneNumber == phoneNumber);
		if (excludeId.HasValue) query = query.Where(c => c.Id != excludeId.Value);
		return await query.AnyAsync(cancellationToken);
	}

	public async Task<CustomerHistoryResponse> GetHistoryAsync(Guid customerId, CancellationToken cancellationToken = default)
	{
		var customer = await _db.Customers
			.Include(c => c.Vehicles)
			.FirstOrDefaultAsync(c => c.Id == customerId, cancellationToken);

		if (customer is null)
			return new CustomerHistoryResponse(customerId, string.Empty, string.Empty, 0, 0, Array.Empty<CustomerJobCardHistoryItemDto>(), 0m, 0m, 0m);

		// Query job cards explicitly for this customer
		var jobCards = await _db.JobCards
			.Where(j => j.CustomerId == customerId && !j.IsDeleted)
			.Include(j => j.JobCardServices)
				.ThenInclude(js => js.Service)
			.Include(j => j.Vehicle)
			.OrderByDescending(j => j.CreatedAt)
			.ToListAsync(cancellationToken);

		var directJobCardIds = jobCards.Select(j => j.Id).ToHashSet();

		// Query all invoices for this customer OR linked to any of the customer's job cards
		var invoices = await _db.Invoices
			.Include(i => i.Payments)
			.Include(i => i.Vehicle)
			.Where(i => (i.CustomerId == customerId || directJobCardIds.Contains(i.JobCardId)) && !i.IsDeleted)
			.OrderByDescending(i => i.CreatedAt)
			.ToListAsync(cancellationToken);

		// If any invoice points to a JobCard not yet loaded, load it as well
		var missingJobCardIds = invoices
			.Where(i => i.JobCardId != Guid.Empty && !directJobCardIds.Contains(i.JobCardId))
			.Select(i => i.JobCardId)
			.Distinct()
			.ToList();

		if (missingJobCardIds.Count > 0)
		{
			var extraJobCards = await _db.JobCards
				.Where(j => missingJobCardIds.Contains(j.Id) && !j.IsDeleted)
				.Include(j => j.JobCardServices)
					.ThenInclude(js => js.Service)
				.Include(j => j.Vehicle)
				.ToListAsync(cancellationToken);

			jobCards.AddRange(extraJobCards);
			jobCards = jobCards.OrderByDescending(j => j.CreatedAt).ToList();
		}

		var jobCardsById = jobCards.ToDictionary(j => j.Id);

		var vehicleDict = customer.Vehicles
			.Concat(jobCards.Where(j => j.Vehicle != null).Select(j => j.Vehicle!))
			.Concat(invoices.Where(i => i.Vehicle != null).Select(i => i.Vehicle!))
			.DistinctBy(v => v.Id)
			.ToDictionary(v => v.Id);

		var invoiceItems = invoices.Select(inv =>
		{
			var jobCard = inv.JobCardId != Guid.Empty ? jobCardsById.GetValueOrDefault(inv.JobCardId) : null;
			var vehicle = inv.Vehicle ?? jobCard?.Vehicle ?? vehicleDict.GetValueOrDefault(inv.VehicleId);

			var validPayments = inv.Payments.Where(p => !p.IsDeleted).ToList();
			var paymentsSum = validPayments.Sum(p => p.Amount);
			var paidAmount = validPayments.Count > 0 || paymentsSum > 0m ? paymentsSum : inv.PaidAmount;
			var outstandingAmount = Math.Max(0m, inv.TotalAmount - paidAmount);
			string paymentStatus;

			if (inv.Status == InvoiceStatus.Cancelled)
			{
				paymentStatus = "Cancelled";
			}
			else if (inv.Status == InvoiceStatus.Draft)
			{
				paymentStatus = "Draft";
			}
			else if (inv.Status == InvoiceStatus.Paid || (outstandingAmount <= 0m && paidAmount > 0m))
			{
				paymentStatus = "Paid";
			}
			else if (inv.Status == InvoiceStatus.PartiallyPaid || (paidAmount > 0m && outstandingAmount > 0m))
			{
				paymentStatus = "Partially Paid";
			}
			else
			{
				paymentStatus = "Payment Pending";
			}

			return new CustomerJobCardHistoryItemDto(
				JobCardId: jobCard?.Id ?? inv.JobCardId,
				JobCardNumber: jobCard?.JobCardNumber ?? (inv.JobCardId != Guid.Empty ? "JC-LINKED" : string.Empty),
				CreatedAt: inv.CreatedAt,
				Status: inv.Status.ToString(),
				VehicleNumber: vehicle?.RegistrationNumber,
				VehicleModel: vehicle is null ? null : $"{vehicle.Make} {vehicle.Model}{(string.IsNullOrEmpty(vehicle.Variant) ? "" : $" {vehicle.Variant}")}".Trim(),
				Subtotal: inv.Subtotal,
				TaxAmount: inv.GstAmount,
				DiscountAmount: inv.Discount,
				TotalAmount: inv.TotalAmount,
				Vehicles: customer.Vehicles.Select(v => new CustomerVehicleSummaryDto(
					VehicleId: v.Id,
					VehicleNumber: v.RegistrationNumber,
					Model: v.Model,
					Color: v.Color
				)).ToList(),
				InvoiceId: inv.Id,
				InvoiceNumber: inv.InvoiceNumber,
				InvoiceStatus: inv.Status.ToString(),
				InvoiceTotal: inv.TotalAmount,
				PaidAmount: paidAmount,
				OutstandingAmount: outstandingAmount,
				PaymentStatus: paymentStatus
			);
		}).ToList();

		var finalizedInvoices = invoices
			.Where(i => i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Cancelled)
			.ToList();

		var totalOutstandingAmount = finalizedInvoices.Sum(i =>
		{
			var validPayments = i.Payments.Where(p => !p.IsDeleted).ToList();
			var pSum = validPayments.Sum(p => p.Amount);
			var pPaid = validPayments.Count > 0 || pSum > 0m ? pSum : i.PaidAmount;
			return Math.Max(0m, i.TotalAmount - pPaid);
		});

		var totalPaidAmount = finalizedInvoices.Sum(i =>
		{
			var validPayments = i.Payments.Where(p => !p.IsDeleted).ToList();
			var pSum = validPayments.Sum(p => p.Amount);
			return validPayments.Count > 0 || pSum > 0m ? pSum : i.PaidAmount;
		});

		var totalInvoicedAmount = finalizedInvoices.Sum(i => i.TotalAmount);
		var invoiceCount = finalizedInvoices.Count;
		var hasUnpaidInvoice = finalizedInvoices.Any(i =>
		{
			var validPayments = i.Payments.Where(p => !p.IsDeleted).ToList();
			var pSum = validPayments.Sum(p => p.Amount);
			var pPaid = validPayments.Count > 0 || pSum > 0m ? pSum : i.PaidAmount;
			var bal = Math.Max(0m, i.TotalAmount - pPaid);
			return bal > 0 && pPaid == 0;
		});
		var paymentStatus = CalculatePaymentStatus(invoiceCount, totalOutstandingAmount, hasUnpaidInvoice);

		return new CustomerHistoryResponse(
			CustomerId: customer.Id,
			CustomerName: customer.Name,
			PhoneNumber: customer.PhoneNumber,
			TotalJobCards: jobCards.Count,
			TotalVehicles: customer.Vehicles.Count,
			JobCards: invoiceItems,
			TotalOutstandingAmount: totalOutstandingAmount,
			TotalPaidAmount: totalPaidAmount,
			TotalInvoicedAmount: totalInvoicedAmount,
			PaymentStatus: paymentStatus,
			InvoiceCount: invoiceCount
		);
	}

	private static CustomerDto ToDto(Customer c, int vehicleCount, int jobCardCount, decimal totalRevenue) => new(c.Id, c.Name, c.PhoneNumber, c.Email, c.Address, c.CreatedAt, vehicleCount, jobCardCount, totalRevenue);
}
