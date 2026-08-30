using CarSpaManagement.Api.Application.DTOs.Services;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public class ServiceService : IServiceService
{
	private readonly AppDbContext _db;
	private readonly IAuditLogService _auditLogService;

	public ServiceService(AppDbContext db, IAuditLogService auditLogService)
	{
		_db = db;
		_auditLogService = auditLogService;
	}

	public async Task<ServiceDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
	{
		var s = await _db.Services.FindAsync([id], cancellationToken);
		return s is null ? null : ToDto(s);
	}

	public async Task<IReadOnlyList<ServiceDto>> GetAllAsync(bool? isActive = null, int page = 1, int pageSize = 50, string? search = null, string? category = null, CancellationToken cancellationToken = default)
	{
		var query = _db.Services.AsQueryable();

		if (isActive.HasValue) query = query.Where(s => s.IsActive == isActive.Value);
		if (!string.IsNullOrWhiteSpace(search))
		{
			var term = search.Trim().ToLower();
			if (term.Length < 3)
			{
				query = query.Where(s => s.Name.ToLower().Contains(term) || (s.Category != null && s.Category.ToLower().Contains(term)));
			}
			else
			{
				query = query.Where(s => s.Name.ToLower().Contains(term) || (s.Category != null && s.Category.ToLower().Contains(term)) || (s.Description != null && s.Description.ToLower().Contains(term)));
			}
		}
		if (!string.IsNullOrWhiteSpace(category))
		{
			category = category.Trim();
			query = query.Where(s => s.Category == category);
		}

		if (!string.IsNullOrWhiteSpace(search))
		{
			var term = search.Trim().ToLower();
			query = query.OrderBy(s => s.Name.ToLower().StartsWith(term) ? 1 : s.Name.ToLower().Contains(term) ? 2 : 3).ThenBy(s => s.Name);
		}
		else
		{
			query = query.OrderBy(s => s.Name);
		}

		return await query.Skip((page - 1) * pageSize).Take(pageSize).Select(s => ToDto(s)).ToListAsync(cancellationToken);
	}

	public async Task<int> GetTotalCountAsync(bool? isActive = null, string? search = null, string? category = null, CancellationToken cancellationToken = default)
	{
		var query = _db.Services.AsQueryable();
		if (isActive.HasValue) query = query.Where(s => s.IsActive == isActive.Value);
		if (!string.IsNullOrWhiteSpace(search))
		{
			var term = search.Trim().ToLower();
			if (term.Length < 3)
			{
				query = query.Where(s => s.Name.ToLower().Contains(term) || (s.Category != null && s.Category.ToLower().Contains(term)));
			}
			else
			{
				query = query.Where(s => s.Name.ToLower().Contains(term) || (s.Category != null && s.Category.ToLower().Contains(term)) || (s.Description != null && s.Description.ToLower().Contains(term)));
			}
		}
		if (!string.IsNullOrWhiteSpace(category))
		{
			category = category.Trim();
			query = query.Where(s => s.Category == category);
		}
		return await query.CountAsync(cancellationToken);
	}

	public async Task<IReadOnlyList<string>> GetCategoriesAsync(CancellationToken cancellationToken = default)
	{
		return await _db.Services.Where(s => !s.IsDeleted && !string.IsNullOrEmpty(s.Category)).Select(s => s.Category!).Distinct().OrderBy(c => c).ToListAsync(cancellationToken);
	}

	public async Task<ServiceDto> CreateAsync(CreateServiceRequest request, CancellationToken cancellationToken = default)
	{
		var service = new Service
		{
			Name = request.Name.Trim(),
			Description = request.Description?.Trim(),
			Category = request.Category?.Trim(),
			Price = request.Price,
			TaxPercentage = request.TaxPercentage,
			DurationMinutes = request.DurationMinutes,
			IsActive = request.IsActive
		};

		await _db.Services.AddAsync(service, cancellationToken);
		await _db.SaveChangesAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: "catalogue.create",
			module: "Catalogue",
			description: $"Service '{service.Name}' created in catalogue. Price: ₹{service.Price:F2}.",
			entityType: "Service",
			entityId: service.Id,
			entityReference: service.Name,
			outcome: "Success",
			cancellationToken: cancellationToken);

		return ToDto(service);
	}

	public async Task<ServiceDto?> UpdateAsync(Guid id, UpdateServiceRequest request, CancellationToken cancellationToken = default)
	{
		var service = await _db.Services.FindAsync([id], cancellationToken);
		if (service is null) return null;

		var oldPrice = service.Price;
		service.Name = request.Name.Trim();
		service.Description = request.Description?.Trim();
		service.Category = request.Category?.Trim();
		service.Price = request.Price;
		service.TaxPercentage = request.TaxPercentage;
		service.DurationMinutes = request.DurationMinutes;
		service.IsActive = request.IsActive;
		service.UpdatedAt = DateTime.UtcNow;

		await _db.SaveChangesAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: "catalogue.edit",
			module: "Catalogue",
			description: $"Service '{service.Name}' updated. Price: ₹{oldPrice:F2} -> ₹{service.Price:F2}, Active: {service.IsActive}.",
			entityType: "Service",
			entityId: service.Id,
			entityReference: service.Name,
			outcome: "Success",
			cancellationToken: cancellationToken);

		return ToDto(service);
	}

	public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
	{
		var service = await _db.Services.FindAsync([id], cancellationToken);
		if (service is null) return false;

		service.IsDeleted = true;
		service.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync(cancellationToken);

		await _auditLogService.RecordAsync(
			action: "catalogue.delete",
			module: "Catalogue",
			description: $"Service '{service.Name}' deleted from catalogue.",
			entityType: "Service",
			entityId: service.Id,
			entityReference: service.Name,
			outcome: "Success",
			cancellationToken: cancellationToken);

		return true;
	}

 public async Task<bool> NameExistsAsync(string name, Guid? excludeId = null, CancellationToken cancellationToken = default)
 {
 var query = _db.Services.Where(s => s.Name == name);
 if (excludeId.HasValue) query = query.Where(s => s.Id != excludeId.Value);
 return await query.AnyAsync(cancellationToken);
 }

 private static ServiceDto ToDto(Service s) => new(s.Id, s.Name, s.Description, s.Category, s.Price, s.TaxPercentage, s.DurationMinutes, s.IsActive, s.CreatedAt);
}
