using CarSpaManagement.Api.Application.DTOs.Vehicles;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public class VehicleService : IVehicleService
{
 private readonly AppDbContext _db;

 public VehicleService(AppDbContext db)
 {
 _db = db;
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

 public async Task<VehicleDto> CreateAsync(CreateVehicleRequest request, CancellationToken cancellationToken = default)
 {
 var vehicle = new Vehicle
 {
 RegistrationNumber = request.RegistrationNumber.Trim().ToUpper(),
 Make = request.Make.Trim(),
 Model = request.Model.Trim(),
 Variant = request.Variant?.Trim(),
 Color = request.Color?.Trim(),
 CustomerId = request.CustomerId
 };

 await _db.Vehicles.AddAsync(vehicle, cancellationToken);
 await _db.SaveChangesAsync(cancellationToken);
 return ToDto(vehicle);
 }

 public async Task<VehicleDto?> UpdateAsync(Guid id, UpdateVehicleRequest request, CancellationToken cancellationToken = default)
 {
 var vehicle = await _db.Vehicles.FindAsync([id], cancellationToken);
 if (vehicle is null) return null;

 vehicle.RegistrationNumber = request.RegistrationNumber.Trim().ToUpper();
 vehicle.Make = request.Make.Trim();
 vehicle.Model = request.Model.Trim();
 vehicle.Variant = request.Variant?.Trim();
 vehicle.Color = request.Color?.Trim();
 vehicle.UpdatedAt = DateTime.UtcNow;

 await _db.SaveChangesAsync(cancellationToken);
 return ToDto(vehicle);
 }

 public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
 {
 var vehicle = await _db.Vehicles.FindAsync([id], cancellationToken);
 if (vehicle is null) return false;

 vehicle.IsDeleted = true;
 vehicle.UpdatedAt = DateTime.UtcNow;
 await _db.SaveChangesAsync(cancellationToken);
 return true;
 }

 public async Task<bool> RegistrationNumberExistsAsync(string registrationNumber, Guid? excludeId = null, CancellationToken cancellationToken = default)
 {
 var query = _db.Vehicles.Where(v => v.RegistrationNumber == registrationNumber.ToUpper());
 if (excludeId.HasValue) query = query.Where(v => v.Id != excludeId.Value);
 return await query.AnyAsync(cancellationToken);
 }

 private static VehicleDto ToDto(Vehicle v) => new(v.Id, v.RegistrationNumber, v.Make, v.Model, v.Variant, v.Color, v.CustomerId, v.Customer.Name, v.CreatedAt);
}
