using CarSpaManagement.Api.Application.DTOs.Services;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public class ServiceService : IServiceService
{
 private readonly AppDbContext _db;

 public ServiceService(AppDbContext db)
 {
 _db = db;
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
 search = search.Trim().ToLower();
 query = query.Where(s => s.Name.ToLower().Contains(search) || (s.Description != null && s.Description.ToLower().Contains(search)));
 }
 if (!string.IsNullOrWhiteSpace(category))
 {
 category = category.Trim();
 query = query.Where(s => s.Category == category);
 }

 return await query.OrderBy(s => s.Name).Skip((page - 1) * pageSize).Take(pageSize).Select(s => ToDto(s)).ToListAsync(cancellationToken);
 }

 public async Task<int> GetTotalCountAsync(bool? isActive = null, string? search = null, string? category = null, CancellationToken cancellationToken = default)
 {
 var query = _db.Services.AsQueryable();
 if (isActive.HasValue) query = query.Where(s => s.IsActive == isActive.Value);
 if (!string.IsNullOrWhiteSpace(search))
 {
 search = search.Trim().ToLower();
 query = query.Where(s => s.Name.ToLower().Contains(search) || (s.Description != null && s.Description.ToLower().Contains(search)));
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

 return ToDto(service);
 }

 public async Task<ServiceDto?> UpdateAsync(Guid id, UpdateServiceRequest request, CancellationToken cancellationToken = default)
 {
 var service = await _db.Services.FindAsync([id], cancellationToken);
 if (service is null) return null;

 service.Name = request.Name.Trim();
 service.Description = request.Description?.Trim();
 service.Category = request.Category?.Trim();
 service.Price = request.Price;
 service.TaxPercentage = request.TaxPercentage;
 service.DurationMinutes = request.DurationMinutes;
 service.IsActive = request.IsActive;
 service.UpdatedAt = DateTime.UtcNow;

 await _db.SaveChangesAsync(cancellationToken);
 return ToDto(service);
 }

 public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
 {
 var service = await _db.Services.FindAsync([id], cancellationToken);
 if (service is null) return false;

 service.IsDeleted = true;
 service.UpdatedAt = DateTime.UtcNow;
 await _db.SaveChangesAsync(cancellationToken);
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
