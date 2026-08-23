using CarSpaManagement.Api.Application.DTOs.StaffAdvances;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public class StaffAdvanceService : IStaffAdvanceService
{
 private readonly AppDbContext _db;

 public StaffAdvanceService(AppDbContext db)
 {
 _db = db;
 }

 public async Task<IReadOnlyList<StaffAdvanceDto>> GetAllAsync(int page, int pageSize, Guid? staffId = null, string? status = null, DateTime? fromDate = null, DateTime? toDate = null, string? search = null, CancellationToken cancellationToken = default)
 {
 var query = _db.StaffAdvances.AsQueryable();

 if (staffId.HasValue)
 query = query.Where(a => a.StaffId == staffId.Value);

 if (!string.IsNullOrWhiteSpace(status))
 query = query.Where(a => a.Status == status);

 if (fromDate.HasValue)
 query = query.Where(a => a.AdvanceDate >= fromDate.Value);

 if (toDate.HasValue)
 query = query.Where(a => a.AdvanceDate <= toDate.Value);

 if (!string.IsNullOrWhiteSpace(search))
 {
 search = search.Trim().ToLower();
 query = query.Where(a => a.StaffName.ToLower().Contains(search) || a.Description != null && a.Description.ToLower().Contains(search) || a.AdvanceType.ToLower().Contains(search));
 }

 return await query
 .OrderByDescending(a => a.AdvanceDate)
 .ThenByDescending(a => a.CreatedAt)
 .Skip((page - 1) * pageSize)
 .Take(pageSize)
 .Select(a => ToDto(a))
 .ToListAsync(cancellationToken);
 }

 public async Task<int> GetTotalCountAsync(Guid? staffId = null, string? status = null, DateTime? fromDate = null, DateTime? toDate = null, string? search = null, CancellationToken cancellationToken = default)
 {
 var query = _db.StaffAdvances.AsQueryable();

 if (staffId.HasValue)
 query = query.Where(a => a.StaffId == staffId.Value);

 if (!string.IsNullOrWhiteSpace(status))
 query = query.Where(a => a.Status == status);

 if (fromDate.HasValue)
 query = query.Where(a => a.AdvanceDate >= fromDate.Value);

 if (toDate.HasValue)
 query = query.Where(a => a.AdvanceDate <= toDate.Value);

 if (!string.IsNullOrWhiteSpace(search))
 {
 search = search.Trim().ToLower();
 query = query.Where(a => a.StaffName.ToLower().Contains(search) || a.Description != null && a.Description.ToLower().Contains(search) || a.AdvanceType.ToLower().Contains(search));
 }

 return await query.CountAsync(cancellationToken);
 }

 public async Task<StaffAdvanceDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
 {
 var advance = await _db.StaffAdvances.FindAsync([id], cancellationToken);
 return advance is null ? null : ToDto(advance);
 }

 public async Task<StaffAdvanceDto> CreateAsync(CreateStaffAdvanceRequest request, CancellationToken cancellationToken = default)
 {
 // Find or create the Staff record
 var staff = await _db.Staff
 .FirstOrDefaultAsync(s => s.Name == request.StaffName.Trim(), cancellationToken);

 if (staff is null)
 {
 staff = new Staff
 {
 Id = Guid.NewGuid(),
 Name = request.StaffName.Trim(),
 PhoneNumber = string.Empty,
 Role = request.StaffRole?.Trim() ?? string.Empty,
 IsActive = true
 };

 await _db.Staff.AddAsync(staff, cancellationToken);
 await _db.SaveChangesAsync(cancellationToken);
 }

 var advance = new StaffAdvance
 {
 StaffId = staff.Id,
 StaffName = staff.Name,
 StaffRole = staff.Role,
 AdvanceType = request.AdvanceType.Trim(),
 Description = request.Description?.Trim(),
 Amount = request.Amount,
 AdvanceDate = request.AdvanceDate.Date,
 PaymentMethod = request.PaymentMethod?.Trim(),
 Status = "Pending",
 Notes = request.Notes?.Trim()
 };

 await _db.StaffAdvances.AddAsync(advance, cancellationToken);
 await _db.SaveChangesAsync(cancellationToken);

 return ToDto(advance);
 }

 public async Task<StaffAdvanceDto?> UpdateAsync(Guid id, UpdateStaffAdvanceRequest request, CancellationToken cancellationToken = default)
 {
 var advance = await _db.StaffAdvances.FindAsync([id], cancellationToken);
 if (advance is null) return null;

 if (request.StaffName is not null)
 {
 advance.StaffName = request.StaffName.Trim();

 // Also update Staff record name if it exists
 var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == advance.StaffId, cancellationToken);
 if (staff is not null)
 {
 staff.Name = request.StaffName.Trim();
 staff.UpdatedAt = DateTime.UtcNow;
 }
 }
 if (request.StaffRole is not null) advance.StaffRole = request.StaffRole.Trim();
 if (request.AdvanceType is not null) advance.AdvanceType = request.AdvanceType.Trim();
 if (request.Description is not null) advance.Description = request.Description.Trim();
 if (request.Amount.HasValue) advance.Amount = request.Amount.Value;
 if (request.AdvanceDate.HasValue) advance.AdvanceDate = request.AdvanceDate.Value.Date;
 if (request.PaymentMethod is not null) advance.PaymentMethod = request.PaymentMethod.Trim();
 if (request.Status is not null) advance.Status = request.Status;
 if (request.Notes is not null) advance.Notes = request.Notes.Trim();

 advance.UpdatedAt = DateTime.UtcNow;
 await _db.SaveChangesAsync(cancellationToken);

 return ToDto(advance);
 }

 public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
 {
 var advance = await _db.StaffAdvances.FindAsync([id], cancellationToken);
 if (advance is null) return false;

 advance.IsDeleted = true;
 advance.UpdatedAt = DateTime.UtcNow;
 await _db.SaveChangesAsync(cancellationToken);
 return true;
 }

	public async Task<IReadOnlyList<StaffDto>> GetStaffAsync(CancellationToken cancellationToken = default)
	{
		var staffList = await _db.Staff
			.Where(s => !s.IsDeleted)
			.OrderBy(s => s.Name)
			.ToListAsync(cancellationToken);

		var staffIds = staffList.Select(s => s.Id).ToList();
		var advancesStats = await _db.StaffAdvances
			.Where(a => !a.IsDeleted && staffIds.Contains(a.StaffId))
			.GroupBy(a => a.StaffId)
			.Select(g => new { StaffId = g.Key, Count = g.Count(), Total = g.Sum(x => x.Amount) })
			.ToDictionaryAsync(x => x.StaffId, cancellationToken);

		return staffList.Select(s => {
			var hasStats = advancesStats.TryGetValue(s.Id, out var st);
			return new StaffDto(
				s.Id,
				s.Name,
				s.PhoneNumber,
				s.Email,
				s.Address,
				s.Role,
				s.IsActive,
				hasStats && st != null ? st.Count : 0,
				hasStats && st != null ? st.Total : 0m);
		}).ToList();
	}

	public async Task<StaffDto?> GetStaffByIdAsync(Guid staffId, CancellationToken cancellationToken = default)
	{
		var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken);
		if (staff is null) return null;

		var advancesQuery = _db.StaffAdvances.Where(a => a.StaffId == staffId && !a.IsDeleted);
		var totalAdvances = await advancesQuery.CountAsync(cancellationToken);
		var totalAmount = await advancesQuery.SumAsync(a => (decimal?)a.Amount, cancellationToken) ?? 0m;

		return new StaffDto(
			staff.Id,
			staff.Name,
			staff.PhoneNumber,
			staff.Email,
			staff.Address,
			staff.Role,
			staff.IsActive,
			totalAdvances,
			totalAmount);
	}

	public async Task<StaffDto> CreateStaffMemberAsync(CreateStaffRequest request, CancellationToken cancellationToken = default)
	{
		var staff = new Staff
		{
			Id = Guid.NewGuid(),
			Name = request.Name.Trim(),
			PhoneNumber = request.PhoneNumber.Trim(),
			Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
			Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim(),
			Role = string.IsNullOrWhiteSpace(request.Role) ? null : request.Role.Trim(),
			IsActive = request.IsActive
		};

		await _db.Staff.AddAsync(staff, cancellationToken);
		await _db.SaveChangesAsync(cancellationToken);

		return new StaffDto(
			staff.Id,
			staff.Name,
			staff.PhoneNumber,
			staff.Email,
			staff.Address,
			staff.Role,
			staff.IsActive,
			0,
			0m);
	}

	public async Task<StaffDto?> UpdateStaffMemberAsync(Guid staffId, UpdateStaffRequest request, CancellationToken cancellationToken = default)
	{
		var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken);
		if (staff is null) return null;

		if (request.Name is not null) staff.Name = request.Name.Trim();
		if (request.PhoneNumber is not null) staff.PhoneNumber = request.PhoneNumber.Trim();
		if (request.Email is not null) staff.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
		if (request.Address is not null) staff.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
		if (request.Role is not null) staff.Role = string.IsNullOrWhiteSpace(request.Role) ? null : request.Role.Trim();
		if (request.IsActive.HasValue) staff.IsActive = request.IsActive.Value;

		staff.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync(cancellationToken);

		var advancesQuery = _db.StaffAdvances.Where(a => a.StaffId == staffId && !a.IsDeleted);
		var totalAdvances = await advancesQuery.CountAsync(cancellationToken);
		var totalAmount = await advancesQuery.SumAsync(a => (decimal?)a.Amount, cancellationToken) ?? 0m;

		return new StaffDto(
			staff.Id,
			staff.Name,
			staff.PhoneNumber,
			staff.Email,
			staff.Address,
			staff.Role,
			staff.IsActive,
			totalAdvances,
			totalAmount);
	}

	public async Task<bool> DeleteStaffMemberAsync(Guid staffId, CancellationToken cancellationToken = default)
	{
		var staff = await _db.Staff.FirstOrDefaultAsync(s => s.Id == staffId && !s.IsDeleted, cancellationToken);
		if (staff is null) return false;

		staff.IsDeleted = true;
		staff.UpdatedAt = DateTime.UtcNow;
		await _db.SaveChangesAsync(cancellationToken);
		return true;
	}

 public async Task<IReadOnlyList<StaffAdvanceDto>> GetByStaffIdAsync(Guid staffId, CancellationToken cancellationToken = default)
 {
 return await _db.StaffAdvances
 .Where(a => a.StaffId == staffId)
 .OrderByDescending(a => a.AdvanceDate)
 .Select(a => ToDto(a))
 .ToListAsync(cancellationToken);
 }

 private static StaffAdvanceDto ToDto(StaffAdvance a) => new(
 a.Id,
 a.StaffId.ToString(),
 a.StaffName,
 a.StaffRole,
 a.AdvanceType,
 a.Description,
 a.Amount,
 a.AdvanceDate,
 a.PaymentMethod,
 a.Status ?? "Pending",
 a.Notes,
 a.CreatedAt);
}
