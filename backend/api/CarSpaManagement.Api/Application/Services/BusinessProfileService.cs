using System.Text.RegularExpressions;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Settings;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public partial class BusinessProfileService : IBusinessProfileService
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _environment;
    private readonly IAuditLogService _auditLogService;

    [GeneratedRegex(@"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", RegexOptions.Compiled | RegexOptions.IgnoreCase)]
    private static partial Regex GstinRegex();

    private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".webp"
    };

    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/pjpeg", "image/webp"
    };

    private const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    public BusinessProfileService(AppDbContext db, IWebHostEnvironment environment, IAuditLogService auditLogService)
    {
        _db = db;
        _environment = environment;
        _auditLogService = auditLogService;
    }

    public async Task<BusinessProfileDto> GetProfileAsync(CancellationToken ct = default)
    {
        var profile = await GetOrCreateProfileEntityAsync(ct);
        return ToDto(profile);
    }

    public async Task<BusinessProfileDto> UpdateProfileAsync(UpdateBusinessProfileRequest request, CancellationToken ct = default)
    {
        var profile = await GetOrCreateProfileEntityAsync(ct);

        // Normalize & Validate GSTIN
        string? normalizedGstin = null;
        if (!string.IsNullOrWhiteSpace(request.Gstin))
        {
            normalizedGstin = request.Gstin.Trim().ToUpperInvariant();
            if (!GstinRegex().IsMatch(normalizedGstin))
            {
                throw new ValidationException("Invalid Indian GSTIN structure. Expected 15-character format (e.g., 33AAAAA0000A1Z5).");
            }
        }

        profile.BusinessName = request.BusinessName.Trim();
        profile.AddressLine1 = request.AddressLine1.Trim();
        profile.AddressLine2 = string.IsNullOrWhiteSpace(request.AddressLine2) ? null : request.AddressLine2.Trim();
        profile.City = request.City.Trim();
        profile.State = request.State.Trim();
        profile.PostalCode = request.PostalCode.Trim();
        profile.Phone = request.Phone.Trim();
        profile.Email = request.Email.Trim().ToLowerInvariant();
        profile.Gstin = normalizedGstin;

        if (request.LogoPath != null)
        {
            profile.LogoPath = string.IsNullOrWhiteSpace(request.LogoPath) ? null : request.LogoPath.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.InvoicePrefix))
        {
            profile.InvoicePrefix = request.InvoicePrefix.Trim().ToUpperInvariant();
        }

        if (request.TermsAndConditions != null)
        {
            profile.TermsAndConditions = string.IsNullOrWhiteSpace(request.TermsAndConditions) ? null : request.TermsAndConditions.Trim();
        }

        profile.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: Domain.Constants.AuditActions.BusinessProfileUpdated,
            module: Domain.Constants.AuditModules.Settings,
            description: $"Business profile updated ({profile.BusinessName}).",
            entityType: "BusinessProfile",
            entityId: profile.Id,
            entityReference: profile.BusinessName,
            newValues: System.Text.Json.JsonSerializer.Serialize(new {
                businessName = profile.BusinessName,
                gstin = profile.Gstin,
                phone = profile.Phone,
                email = profile.Email
            }),
            outcome: "Success",
            cancellationToken: ct);

        return ToDto(profile);
    }

    public async Task<LogoUploadResponse> UploadLogoAsync(IFormFile file, CancellationToken ct = default)
    {
        if (file == null || file.Length == 0)
        {
            throw new ValidationException("Please choose an image file to upload.");
        }

        if (file.Length > MaxFileSizeBytes)
        {
            throw new ValidationException("Logo image size cannot exceed 5 MB.");
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext) || !AllowedImageExtensions.Contains(ext))
        {
            throw new ValidationException("Only PNG, JPEG, and WebP image formats are supported for business logo.");
        }

        if (!AllowedMimeTypes.Contains(file.ContentType))
        {
            throw new ValidationException("Invalid image content type. Please upload a valid PNG, JPEG, or WebP image.");
        }

        // Determine server storage root
        var webRoot = _environment.WebRootPath;
        if (string.IsNullOrEmpty(webRoot))
        {
            webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        }

        var uploadsDir = Path.Combine(webRoot, "uploads", "logos");
        if (!Directory.Exists(uploadsDir))
        {
            Directory.CreateDirectory(uploadsDir);
        }

        // Generate safe random server-side filename
        var safeFileName = $"logo_{Guid.NewGuid():N}{ext}";
        var physicalPath = Path.Combine(uploadsDir, safeFileName);

        await using (var stream = new FileStream(physicalPath, FileMode.Create, FileAccess.Write))
        {
            await file.CopyToAsync(stream, ct);
        }

        var relativeUrl = $"/uploads/logos/{safeFileName}";

        var profile = await GetOrCreateProfileEntityAsync(ct);
        profile.LogoPath = relativeUrl;
        profile.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: Domain.Constants.AuditActions.LogoChanged,
            module: Domain.Constants.AuditModules.Settings,
            description: $"Business profile logo uploaded/updated: '{relativeUrl}'.",
            entityType: "BusinessProfile",
            entityId: profile.Id,
            entityReference: profile.BusinessName,
            outcome: "Success",
            cancellationToken: ct);

        return new LogoUploadResponse(relativeUrl, ToDto(profile));
    }

    public async Task<BusinessProfileDto> RemoveLogoAsync(CancellationToken ct = default)
    {
        var profile = await GetOrCreateProfileEntityAsync(ct);
        profile.LogoPath = null;
        profile.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: Domain.Constants.AuditActions.LogoRemoved,
            module: Domain.Constants.AuditModules.Settings,
            description: "Business profile logo removed.",
            entityType: "BusinessProfile",
            entityId: profile.Id,
            entityReference: profile.BusinessName,
            outcome: "Success",
            cancellationToken: ct);

        return ToDto(profile);
    }

    private async Task<BusinessProfile> GetOrCreateProfileEntityAsync(CancellationToken ct)
    {
        var profile = await _db.BusinessProfiles
            .FirstOrDefaultAsync(b => b.SingletonKey == 1 && !b.IsDeleted, ct);

        if (profile != null) return profile;

        // Initialize verified default E6 Car Spa business profile
        profile = new BusinessProfile
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            BusinessName = "E6 Car Spa",
            AddressLine1 = "36, Geetha Nagar Main Road",
            AddressLine2 = "Behind Sakthi Mahal, Perundurai Road",
            City = "Erode",
            State = "Tamil Nadu",
            PostalCode = "638011",
            Phone = "+91 9578749449",
            Email = "e6carspaerd@gmail.com",
            Gstin = null,
            LogoPath = "/uploads/logos/e6-logo.png",
            InvoicePrefix = "INV",
            CreatedAt = DateTime.UtcNow
        };

        _db.BusinessProfiles.Add(profile);
        await _db.SaveChangesAsync(ct);

        return profile;
    }

    private static BusinessProfileDto ToDto(BusinessProfile b) => new(
        b.Id,
        b.BusinessName,
        b.AddressLine1,
        b.AddressLine2,
        b.City,
        b.State,
        b.PostalCode,
        b.Phone,
        b.Email,
        b.Gstin,
        b.LogoPath,
        b.InvoicePrefix,
        b.TermsAndConditions,
        b.CreatedAt,
        b.UpdatedAt
    );
}
