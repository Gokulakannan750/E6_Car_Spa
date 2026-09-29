using CarSpaManagement.Api.Application.DTOs.Vendors;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public class VendorService : IVendorService
{
    private readonly AppDbContext _db;
    private readonly IAuditLogService _auditLogService;

    public VendorService(AppDbContext db, IAuditLogService auditLogService)
    {
        _db = db;
        _auditLogService = auditLogService;
    }

    public async Task<IReadOnlyList<VendorDto>> GetAllAsync(bool activeOnly = false, CancellationToken cancellationToken = default)
    {
        var query = _db.Vendors.AsNoTracking().Where(v => !v.IsDeleted);
        if (activeOnly)
        {
            query = query.Where(v => v.IsActive);
        }

        return await query
            .OrderBy(v => v.Name)
            .Select(v => new VendorDto(
                v.Id,
                v.Name,
                v.Phone,
                v.ContactPerson,
                v.Address,
                v.ServiceSpecialty,
                v.IsActive,
                v.CreatedAt,
                v.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<VendorDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var v = await _db.Vendors.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, cancellationToken);

        if (v == null) return null;

        return new VendorDto(
            v.Id,
            v.Name,
            v.Phone,
            v.ContactPerson,
            v.Address,
            v.ServiceSpecialty,
            v.IsActive,
            v.CreatedAt,
            v.UpdatedAt);
    }

    public async Task<VendorDto> CreateAsync(CreateVendorRequest request, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var vendor = new Vendor
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Phone = request.Phone?.Trim(),
            ContactPerson = request.ContactPerson?.Trim(),
            Address = request.Address?.Trim(),
            ServiceSpecialty = request.ServiceSpecialty?.Trim(),
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            IsDeleted = false
        };

        _db.Vendors.Add(vendor);
        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: "vendors.create",
            module: "Vendors",
            description: $"External vendor '{vendor.Name}' created.",
            entityType: "Vendor",
            entityId: vendor.Id,
            entityReference: vendor.Name,
            outcome: "Success",
            cancellationToken: cancellationToken);

        return new VendorDto(
            vendor.Id,
            vendor.Name,
            vendor.Phone,
            vendor.ContactPerson,
            vendor.Address,
            vendor.ServiceSpecialty,
            vendor.IsActive,
            vendor.CreatedAt,
            vendor.UpdatedAt);
    }

    public async Task<VendorDto?> UpdateAsync(Guid id, UpdateVendorRequest request, CancellationToken cancellationToken = default)
    {
        var vendor = await _db.Vendors.FirstOrDefaultAsync(v => v.Id == id && !v.IsDeleted, cancellationToken);
        if (vendor == null) return null;

        vendor.Name = request.Name.Trim();
        vendor.Phone = request.Phone?.Trim();
        vendor.ContactPerson = request.ContactPerson?.Trim();
        vendor.Address = request.Address?.Trim();
        vendor.ServiceSpecialty = request.ServiceSpecialty?.Trim();
        vendor.IsActive = request.IsActive;
        vendor.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: "vendors.edit",
            module: "Vendors",
            description: $"External vendor '{vendor.Name}' updated.",
            entityType: "Vendor",
            entityId: vendor.Id,
            entityReference: vendor.Name,
            outcome: "Success",
            cancellationToken: cancellationToken);

        return new VendorDto(
            vendor.Id,
            vendor.Name,
            vendor.Phone,
            vendor.ContactPerson,
            vendor.Address,
            vendor.ServiceSpecialty,
            vendor.IsActive,
            vendor.CreatedAt,
            vendor.UpdatedAt);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var vendor = await _db.Vendors.FirstOrDefaultAsync(v => v.Id == id && !v.IsDeleted, cancellationToken);
        if (vendor == null) return false;

        // Check if referenced in any outside jobs
        var hasJobs = await _db.OutsideJobs.AnyAsync(o => o.VendorId == id && !o.IsDeleted, cancellationToken);
        if (hasJobs)
        {
            // Soft deactivate rather than hard delete to preserve historical integrity
            vendor.IsActive = false;
            vendor.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
        }
        else
        {
            vendor.IsDeleted = true;
            vendor.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
        }

        await _auditLogService.RecordAsync(
            action: "vendors.delete",
            module: "Vendors",
            description: $"External vendor '{vendor.Name}' deleted/deactivated.",
            entityType: "Vendor",
            entityId: vendor.Id,
            entityReference: vendor.Name,
            outcome: "Success",
            cancellationToken: cancellationToken);

        return true;
    }
}
