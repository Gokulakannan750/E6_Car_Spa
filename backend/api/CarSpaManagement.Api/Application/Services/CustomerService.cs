using CarSpaManagement.Api.Application.DTOs.Customers;
using CarSpaManagement.Api.Application.Interfaces;
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
 var c = await _db.Customers
 .Where(x => x.Id == id)
 .Select(x => new CustomerDto(x.Id, x.Name, x.PhoneNumber, x.Email, x.Address, x.CreatedAt, x.Vehicles.Count, x.JobCards.Count, x.JobCards.Sum(j => j.TotalAmount), x.Vehicles.Select(v => v.RegistrationNumber).ToList()))
 .FirstOrDefaultAsync(cancellationToken);
 return c;
 }

 public async Task<CustomerDto?> GetByPhoneAsync(string phoneNumber, CancellationToken cancellationToken = default)
 {
 if (string.IsNullOrWhiteSpace(phoneNumber)) return null;

 var digits = new string(phoneNumber.Where(char.IsDigit).ToArray());
 if (digits.Length == 0) return null;

 var c = await _db.Customers
 .Where(x => x.PhoneNumber == phoneNumber.Trim())
 .Select(x => new CustomerDto(x.Id, x.Name, x.PhoneNumber, x.Email, x.Address, x.CreatedAt, x.Vehicles.Count, x.JobCards.Count, x.JobCards.Sum(j => j.TotalAmount), x.Vehicles.Select(v => v.RegistrationNumber).ToList()))
 .FirstOrDefaultAsync(cancellationToken);

 if (c is not null) return c;

 c = await _db.Customers
 .Where(x => x.PhoneNumber.Contains(digits))
 .Select(x => new CustomerDto(x.Id, x.Name, x.PhoneNumber, x.Email, x.Address, x.CreatedAt, x.Vehicles.Count, x.JobCards.Count, x.JobCards.Sum(j => j.TotalAmount), x.Vehicles.Select(v => v.RegistrationNumber).ToList()))
 .FirstOrDefaultAsync(cancellationToken);

 return c;
 }

 public async Task<CustomerDto?> GetByRegistrationAsync(string registrationNumber, CancellationToken cancellationToken = default)
 {
 if (string.IsNullOrWhiteSpace(registrationNumber)) return null;

 var reg = registrationNumber.Trim().ToUpper();

 return await _db.Vehicles
 .Where(v => v.RegistrationNumber == reg)
 .Select(v => new CustomerDto(
 v.Customer.Id,
 v.Customer.Name,
 v.Customer.PhoneNumber,
 v.Customer.Email,
 v.Customer.Address,
 v.Customer.CreatedAt,
 v.Customer.Vehicles.Count,
 v.Customer.JobCards.Count,
 v.Customer.JobCards.Sum(j => j.TotalAmount),
 v.Customer.Vehicles.Select(x => x.RegistrationNumber).ToList()
 ))
 .FirstOrDefaultAsync(cancellationToken);
 }

 public async Task<IReadOnlyList<CustomerDto>> GetAllAsync(int page, int pageSize, string? search = null, CancellationToken cancellationToken = default)
 {
 var query = _db.Customers.AsQueryable();

 if (!string.IsNullOrWhiteSpace(search))
 {
 search = search.Trim().ToLower();
 query = query.Where(c => c.Name.ToLower().Contains(search) || c.PhoneNumber.Contains(search) || (c.Email != null && c.Email.ToLower().Contains(search)) || c.Vehicles.Any(v => v.RegistrationNumber.ToLower().Contains(search)));
 }

 return await query
 .OrderByDescending(c => c.CreatedAt)
 .Skip((page - 1) * pageSize)
 .Take(pageSize)
 .Select(c => new CustomerDto(
 c.Id,
 c.Name,
 c.PhoneNumber,
 c.Email,
 c.Address,
 c.CreatedAt,
 c.Vehicles.Count,
 c.JobCards.Count,
 c.JobCards.Sum(j => j.TotalAmount),
 c.Vehicles.Select(v => v.RegistrationNumber).ToList()
 ))
 .ToListAsync(cancellationToken);
 }

 public async Task<int> GetTotalCountAsync(string? search = null, CancellationToken cancellationToken = default)
 {
 var query = _db.Customers.AsQueryable();
 if (!string.IsNullOrWhiteSpace(search))
 {
 search = search.Trim().ToLower();
 query = query.Where(c => c.Name.ToLower().Contains(search) || c.PhoneNumber.Contains(search) || (c.Email != null && c.Email.ToLower().Contains(search)) || c.Vehicles.Any(v => v.RegistrationNumber.ToLower().Contains(search)));
 }
 return await query.CountAsync(cancellationToken);
 }

	public async Task<CustomerDto> CreateAsync(CreateCustomerRequest request, CancellationToken cancellationToken = default)
	{
		var customer = new Customer
		{
			Name = request.Name.Trim(),
			PhoneNumber = request.PhoneNumber.Trim(),
			Email = request.Email?.Trim(),
			Address = request.Address?.Trim()
		};

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

		return new CustomerDto(customer.Id, customer.Name, customer.PhoneNumber, customer.Email, customer.Address, customer.CreatedAt, 0, 0, 0);
	}

	public async Task<CustomerDto?> UpdateAsync(Guid id, UpdateCustomerRequest request, CancellationToken cancellationToken = default)
	{
		var customer = await _db.Customers.FindAsync([id], cancellationToken);
		if (customer is null) return null;

		customer.Name = request.Name.Trim();
		customer.PhoneNumber = request.PhoneNumber.Trim();
		customer.Email = request.Email?.Trim();
		customer.Address = request.Address?.Trim();
		customer.UpdatedAt = DateTime.UtcNow;

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

		return new CustomerDto(customer.Id, customer.Name, customer.PhoneNumber, customer.Email, customer.Address, customer.CreatedAt, 0, 0, 0);
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
 .Include(c => c.JobCards.OrderByDescending(j => j.CreatedAt))
 .ThenInclude(j => j.JobCardServices)
 .ThenInclude(js => js.Service)
 .FirstOrDefaultAsync(c => c.Id == customerId, cancellationToken);

 if (customer is null)
 return new CustomerHistoryResponse(customerId, string.Empty, string.Empty, 0, 0, Array.Empty<CustomerJobCardHistoryItemDto>());

 var vehicleDict = customer.Vehicles.ToDictionary(v => v.Id);

 var jobCardItems = customer.JobCards.Select(jc =>
 {
 var vehicle = vehicleDict.GetValueOrDefault(jc.VehicleId);
 return new CustomerJobCardHistoryItemDto(
 JobCardId: jc.Id,
 JobCardNumber: jc.JobCardNumber,
 CreatedAt: jc.CreatedAt,
 Status: jc.Status.ToString(),
 VehicleNumber: vehicle?.RegistrationNumber,
 VehicleModel: vehicle is null ? null : $"{vehicle.Make} {vehicle.Model}{(string.IsNullOrEmpty(vehicle.Variant) ? "" : $" {vehicle.Variant}")}".Trim(),
 Subtotal: jc.Subtotal,
 TaxAmount: jc.TaxAmount,
 DiscountAmount: jc.DiscountAmount,
 TotalAmount: jc.TotalAmount,
 Vehicles: customer.Vehicles.Select(v => new CustomerVehicleSummaryDto(
 VehicleId: v.Id,
 VehicleNumber: v.RegistrationNumber,
 Model: v.Model,
 Color: v.Color
 )).ToList()
 );
 }).ToList();

 return new CustomerHistoryResponse(
 CustomerId: customer.Id,
 CustomerName: customer.Name,
 PhoneNumber: customer.PhoneNumber,
 TotalJobCards: customer.JobCards.Count,
 TotalVehicles: customer.Vehicles.Count,
 JobCards: jobCardItems
 );
 }

 private static CustomerDto ToDto(Customer c, int vehicleCount, int jobCardCount, decimal totalRevenue) => new(c.Id, c.Name, c.PhoneNumber, c.Email, c.Address, c.CreatedAt, vehicleCount, jobCardCount, totalRevenue);
}
