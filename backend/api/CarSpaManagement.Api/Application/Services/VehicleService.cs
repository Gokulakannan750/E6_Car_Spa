using System.Text.RegularExpressions;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Vehicles;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public class VehicleService : IVehicleService
{
	private readonly AppDbContext _db;
	private readonly IAuditLogService _auditLogService;

	public VehicleService(AppDbContext db, IAuditLogService auditLogService)
	{
		_db = db;
		_auditLogService = auditLogService;
	}

	public async Task<VehicleDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
	{
		var v = await _db.Vehicles
			.Include(v => v.Customer)
			.FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
		return v is null ? null : ToDto(v);
	}

	public async Task<IReadOnlyList<VehicleDto>> GetByCustomerIdAsync(Guid customerId, CancellationToken cancellationToken = default)
	{
		return await _db.Vehicles
			.Where(v => v.CustomerId == customerId)
			.OrderByDescending(v => v.CreatedAt)
			.Include(v => v.Customer)
			.Select(v => ToDto(v))
			.ToListAsync(cancellationToken);
	}

	public async Task<IReadOnlyList<VehicleDto>> GetAllAsync(int page, int pageSize, string? search = null, CancellationToken cancellationToken = default)
	{
		var query = _db.Vehicles.AsQueryable();

		if (!string.IsNullOrWhiteSpace(search))
		{
			search = search.Trim().ToLower();
			query = query.Where(v => EF.Functions.Like(v.RegistrationNumber.ToLower(), $"%{search}%") || EF.Functions.Like(v.Make.ToLower(), $"%{search}%") || EF.Functions.Like(v.Model.ToLower(), $"%{search}%"));
		}

		return await query.OrderByDescending(v => v.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).Include(v => v.Customer).Select(v => ToDto(v)).ToListAsync(cancellationToken);
	}

	public async Task<int> GetTotalCountAsync(string? search = null, CancellationToken cancellationToken = default)
	{
		var query = _db.Vehicles.AsQueryable();
		if (!string.IsNullOrWhiteSpace(search))
		{
			search = search.Trim().ToLower();
			query = query.Where(v => v.RegistrationNumber.ToLower().Contains(search) || v.Make.ToLower().Contains(search) || v.Model.ToLower().Contains(search));
		}
		return await query.CountAsync(cancellationToken);
	}

	public static string NormalizeRegistration(string? registrationNumber)
	{
		if (string.IsNullOrWhiteSpace(registrationNumber)) return string.Empty;
		return Regex.Replace(registrationNumber.Trim().ToUpper(), @"[\s\-]", "");
	}

	public async Task<VehicleDto> CreateAsync(CreateVehicleRequest request, CancellationToken cancellationToken = default)
	{
		var normalizedReg = NormalizeRegistration(request.RegistrationNumber);
		var vehicle = new Vehicle
		{
			RegistrationNumber = normalizedReg,
			Make = request.Make.Trim(),
			Model = request.Model.Trim(),
			Variant = request.Variant?.Trim(),
			Color = request.Color?.Trim(),
			CustomerId = request.CustomerId
		};

		try
		{
			await _db.Vehicles.AddAsync(vehicle, cancellationToken);
			await _db.SaveChangesAsync(cancellationToken);
		}
		catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
		{
			throw new ConflictException($"A vehicle with registration number '{normalizedReg}' already exists.");
		}

		// Load customer for DTO
		await _db.Entry(vehicle).Reference(v => v.Customer).LoadAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: "vehicles.create",
			module: "Vehicles",
			description: $"Vehicle '{vehicle.RegistrationNumber}' ({vehicle.Make} {vehicle.Model}) registered for customer '{vehicle.Customer?.Name}'.",
			entityType: "Vehicle",
			entityId: vehicle.Id,
			entityReference: vehicle.RegistrationNumber,
			outcome: "Success",
			cancellationToken: cancellationToken);

		return ToDto(vehicle);
	}

	public async Task<VehicleDto?> UpdateAsync(Guid id, UpdateVehicleRequest request, CancellationToken cancellationToken = default)
	{
		var vehicle = await _db.Vehicles.Include(v => v.Customer).FirstOrDefaultAsync(v => v.Id == id, cancellationToken);
		if (vehicle is null) return null;

		var normalizedReg = NormalizeRegistration(request.RegistrationNumber);
		vehicle.RegistrationNumber = normalizedReg;
		vehicle.Make = request.Make.Trim();
		vehicle.Model = request.Model.Trim();
		vehicle.Variant = request.Variant?.Trim();
		vehicle.Color = request.Color?.Trim();
		vehicle.UpdatedAt = DateTime.UtcNow;

		try
		{
			await _db.SaveChangesAsync(cancellationToken);
		}
		catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
		{
			throw new ConflictException($"A vehicle with registration number '{normalizedReg}' already exists.");
		}

		await _auditLogService.RecordAsync(
			action: "vehicles.edit",
			module: "Vehicles",
			description: $"Vehicle '{vehicle.RegistrationNumber}' updated.",
			entityType: "Vehicle",
			entityId: vehicle.Id,
			entityReference: vehicle.RegistrationNumber,
			outcome: "Success",
			cancellationToken: cancellationToken);

		return ToDto(vehicle);
	}

	public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
	{
		var vehicle = await _db.Vehicles.FindAsync([id], cancellationToken);
		if (vehicle is null) return false;

		vehicle.IsDeleted = true;
		vehicle.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: "vehicles.delete",
			module: "Vehicles",
			description: $"Vehicle '{vehicle.RegistrationNumber}' deleted.",
			entityType: "Vehicle",
			entityId: vehicle.Id,
			entityReference: vehicle.RegistrationNumber,
			outcome: "Success",
			cancellationToken: cancellationToken);

		return true;
	}

	public async Task<bool> RegistrationNumberExistsAsync(string registrationNumber, Guid? excludeId = null, CancellationToken cancellationToken = default)
	{
		var normalized = NormalizeRegistration(registrationNumber);
		if (string.IsNullOrEmpty(normalized)) return false;

		var query = _db.Vehicles.Where(v => v.RegistrationNumber == normalized);
		if (excludeId.HasValue) query = query.Where(v => v.Id != excludeId.Value);
		return await query.AnyAsync(cancellationToken);
	}

	public async Task<VehicleDto?> GetByRegistrationNumberAsync(string registrationNumber, CancellationToken cancellationToken = default)
	{
		var normalized = NormalizeRegistration(registrationNumber);
		if (string.IsNullOrEmpty(normalized)) return null;

		var vehicle = await _db.Vehicles
			.Include(v => v.Customer)
			.FirstOrDefaultAsync(v => v.RegistrationNumber == normalized, cancellationToken);
		return vehicle is null ? null : ToDto(vehicle);
	}

	public async Task<VehicleDto> TransferOwnershipAsync(Guid vehicleId, Guid newCustomerId, CancellationToken cancellationToken = default)
	{
		var vehicle = await _db.Vehicles
			.Include(v => v.Customer)
			.FirstOrDefaultAsync(v => v.Id == vehicleId && !v.IsDeleted, cancellationToken);
		if (vehicle is null)
			throw new NotFoundException($"Vehicle with ID '{vehicleId}' was not found.");

		var newCustomer = await _db.Customers
			.FirstOrDefaultAsync(c => c.Id == newCustomerId && !c.IsDeleted, cancellationToken);
		if (newCustomer is null)
			throw new NotFoundException($"Customer with ID '{newCustomerId}' was not found.");

		if (vehicle.CustomerId == newCustomerId)
			throw new ConflictException("Vehicle is already owned by this customer.");

		var previousCustomerId = vehicle.CustomerId;
		var previousCustomerName = vehicle.Customer?.Name ?? "Unknown";

		var hasActiveTransaction = _db.Database.CurrentTransaction != null;
		Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? transaction = null;
		if (!hasActiveTransaction && _db.Database.IsRelational())
		{
			transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
		}

		try
		{
			vehicle.CustomerId = newCustomer.Id;
			vehicle.UpdatedAt = DateTime.UtcNow;

			await _db.SaveChangesAsync(cancellationToken);

			await _auditLogService.RecordAsync(
				action: "vehicles.transfer_ownership",
				module: "Vehicles",
				description: $"Ownership of vehicle '{vehicle.RegistrationNumber}' ({vehicle.Make} {vehicle.Model}) transferred from '{previousCustomerName}' to '{newCustomer.Name}'.",
				entityType: "Vehicle",
				entityId: vehicle.Id,
				entityReference: vehicle.RegistrationNumber,
				oldValues: System.Text.Json.JsonSerializer.Serialize(new { customerId = previousCustomerId, customerName = previousCustomerName }),
				newValues: System.Text.Json.JsonSerializer.Serialize(new { customerId = newCustomer.Id, customerName = newCustomer.Name }),
				metadata: System.Text.Json.JsonSerializer.Serialize(new { vehicleId = vehicle.Id, registrationNumber = vehicle.RegistrationNumber, previousCustomerId, newCustomerId = newCustomer.Id }),
				outcome: "Success",
				cancellationToken: cancellationToken);

			if (transaction != null)
			{
				await transaction.CommitAsync(cancellationToken);
			}
		}
		finally
		{
			if (transaction != null)
			{
				await transaction.DisposeAsync();
			}
		}

		return new VehicleDto(vehicle.Id, vehicle.RegistrationNumber, vehicle.Make, vehicle.Model, vehicle.Variant, vehicle.Color, newCustomer.Id, newCustomer.Name, vehicle.CreatedAt);
	}


	private static bool IsUniqueConstraintViolation(DbUpdateException ex)
	{
		if (ex.InnerException is Npgsql.PostgresException pgEx && pgEx.SqlState == "23505")
			return true;

		var msg = ex.InnerException?.Message ?? ex.Message;
		return msg.Contains("UX_Vehicles_RegistrationNumber", StringComparison.OrdinalIgnoreCase) ||
		       msg.Contains("23505", StringComparison.OrdinalIgnoreCase) ||
		       msg.Contains("unique", StringComparison.OrdinalIgnoreCase);
	}

	private static VehicleDto ToDto(Vehicle v) => new(v.Id, v.RegistrationNumber, v.Make, v.Model, v.Variant, v.Color, v.CustomerId, v.Customer.Name, v.CreatedAt);
}
