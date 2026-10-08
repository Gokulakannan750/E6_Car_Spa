using System.Text.RegularExpressions;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Settings;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace CarSpaManagement.Api.Application.Services;

public partial class BusinessProfileService : IBusinessProfileService
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _environment;
    private readonly IAuditLogService _auditLogService;
    private readonly IConfiguration? _configuration;

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

    public BusinessProfileService(AppDbContext db, IWebHostEnvironment environment, IAuditLogService auditLogService, IConfiguration? configuration = null)
    {
        _db = db;
        _environment = environment;
        _auditLogService = auditLogService;
        _configuration = configuration;
    }

    public async Task<BusinessProfileDto> GetProfileAsync(CancellationToken ct = default)
    {
        var profile = await GetOrCreateProfileEntityAsync(ct);
        return ToDto(profile);
    }

    public async Task<PublicBusinessProfileDto> GetPublicProfileAsync(CancellationToken ct = default)
    {
        var profile = await GetOrCreateProfileEntityAsync(ct);
        return new PublicBusinessProfileDto(
            BusinessName: profile.BusinessName,
            LogoPath: profile.LogoPath,
            UpdatedAt: profile.UpdatedAt,
            AppColor: profile.AppColor,
            SidebarColor: profile.SidebarColor,
            LoginImagePath: profile.LoginImagePath
        );
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

        // The platform's own record of the company (shown to a company that is invited into a franchise link).
        var organization = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == _db.CurrentOrganizationId, ct);
        if (organization is not null)
        {
            organization.Name = profile.BusinessName.Length > 150 ? profile.BusinessName[..150] : profile.BusinessName;
        }
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

        // DEPRECATED: request.InvoicePrefix is still accepted for compatibility with older desktop/Android builds, but
        // it is no longer stored or used. Invoice numbers are configured per series (GST / non-GST) through
        // /api/settings/invoice-series; InvoiceNumberSeries is the single source of truth. The column can be dropped
        // once all installed clients are updated.

        if (request.TermsAndConditions != null)
        {
            profile.TermsAndConditions = string.IsNullOrWhiteSpace(request.TermsAndConditions) ? null : request.TermsAndConditions.Trim();
        }

        if (request.Tagline != null)
        {
            profile.Tagline = string.IsNullOrWhiteSpace(request.Tagline) ? null : request.Tagline.Trim();
        }

        if (request.BrandColor != null)
        {
            profile.BrandColor = NormalizeBrandColor(request.BrandColor);
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

    public async Task<BusinessProfileDto> UpdateAppearanceAsync(UpdateAppearanceRequest request, CancellationToken ct = default)
    {
        var profile = await GetOrCreateProfileEntityAsync(ct);

        // Validate everything first so a bad value changes nothing.
        var app = request.AppColor == null ? profile.AppColor : NormalizeBrandColor(request.AppColor, "App colour");
        var sidebar = request.SidebarColor == null ? profile.SidebarColor : NormalizeBrandColor(request.SidebarColor, "Sidebar colour");
        var document = request.BrandColor == null ? profile.BrandColor : NormalizeBrandColor(request.BrandColor, "Document colour");

        profile.AppColor = app;
        profile.SidebarColor = sidebar;
        profile.BrandColor = document;
        profile.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _auditLogService.RecordAsync(
            action: Domain.Constants.AuditActions.BusinessProfileUpdated,
            module: Domain.Constants.AuditModules.Settings,
            description: "Company colours updated.",
            entityType: "BusinessProfile",
            entityId: profile.Id,
            entityReference: profile.BusinessName,
            newValues: System.Text.Json.JsonSerializer.Serialize(new { appColor = app, sidebarColor = sidebar, documentColor = document }),
            cancellationToken: ct);

        return ToDto(profile);
    }

    /// <summary>Accepts #RRGGBB (any case) or empty; returns upper-case #RRGGBB or null.</summary>
    public static string? NormalizeBrandColor(string? value, string label = "Brand colour")
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        if (!System.Text.RegularExpressions.Regex.IsMatch(trimmed, "^#[0-9a-fA-F]{6}$"))
        {
            throw new ValidationException($"{label} must be a colour code like #A11A1A.");
        }
        return trimmed.ToUpperInvariant();
    }

    public async Task<LogoUploadResponse> UploadLogoAsync(IFormFile file, CancellationToken ct = default)
    {
        var relativeUrl = await SaveImageAsync(file, "logos", "logo_", "business logo", ct);

        var profile = await GetOrCreateProfileEntityAsync(ct);
        var previousLogo = profile.LogoPath;
        profile.LogoPath = relativeUrl;
        profile.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        // Safely cleanup the previous custom logo
        SafeDeleteOldCustomLogo(previousLogo);

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

    public async Task<LoginImageUploadResponse> UploadLoginImageAsync(IFormFile file, CancellationToken ct = default)
    {
        var relativeUrl = await SaveImageAsync(file, "login", "login_", "login page picture", ct);

        var profile = await GetOrCreateProfileEntityAsync(ct);
        var previous = profile.LoginImagePath;
        profile.LoginImagePath = relativeUrl;
        profile.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        SafeDeleteOwnUpload(previous, "uploads/login/", "login_");

        await _auditLogService.RecordAsync(
            action: Domain.Constants.AuditActions.LoginImageChanged,
            module: Domain.Constants.AuditModules.Settings,
            description: $"Login page picture uploaded/updated: '{relativeUrl}'.",
            entityType: "BusinessProfile",
            entityId: profile.Id,
            entityReference: profile.BusinessName,
            outcome: "Success",
            cancellationToken: ct);

        return new LoginImageUploadResponse(relativeUrl, ToDto(profile));
    }

    public async Task<BusinessProfileDto> RemoveLoginImageAsync(CancellationToken ct = default)
    {
        var profile = await GetOrCreateProfileEntityAsync(ct);
        var previous = profile.LoginImagePath;
        profile.LoginImagePath = null;
        profile.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        SafeDeleteOwnUpload(previous, "uploads/login/", "login_");

        await _auditLogService.RecordAsync(
            action: Domain.Constants.AuditActions.LoginImageRemoved,
            module: Domain.Constants.AuditModules.Settings,
            description: "Login page picture removed.",
            entityType: "BusinessProfile",
            entityId: profile.Id,
            entityReference: profile.BusinessName,
            outcome: "Success",
            cancellationToken: ct);

        return ToDto(profile);
    }

    /// <summary>
    /// Validates an uploaded picture (size, extension, content type, file signature) and stores it under
    /// wwwroot/uploads/&lt;folder&gt; with a random server-side name. Returns the relative URL.
    /// </summary>
    private async Task<string> SaveImageAsync(IFormFile file, string folder, string filePrefix, string label, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
        {
            throw new ValidationException("Please choose an image file to upload.");
        }

        if (file.Length > MaxFileSizeBytes)
        {
            throw new ValidationException($"The {label} cannot be larger than 5 MB.");
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext) || !AllowedImageExtensions.Contains(ext))
        {
            throw new ValidationException($"Only PNG, JPEG, and WebP image formats are supported for the {label}.");
        }

        if (!AllowedMimeTypes.Contains(file.ContentType))
        {
            throw new ValidationException("Invalid image content type. Please upload a valid PNG, JPEG, or WebP image.");
        }

        // Validate image magic-byte signatures
        await using (var testStream = file.OpenReadStream())
        {
            if (!IsValidImageHeader(testStream, ext))
            {
                throw new ValidationException("The uploaded file signature does not match a valid PNG, JPEG, or WebP image.");
            }
        }

        // Determine server storage root
        var webRoot = _environment.WebRootPath;
        if (string.IsNullOrEmpty(webRoot))
        {
            webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        }

        var uploadsDir = Path.Combine(webRoot, "uploads", folder);
        if (!Directory.Exists(uploadsDir))
        {
            Directory.CreateDirectory(uploadsDir);
        }

        // Generate safe random server-side filename
        var safeFileName = $"{filePrefix}{Guid.NewGuid():N}{ext}";
        var physicalPath = Path.Combine(uploadsDir, safeFileName);

        await using (var stream = new FileStream(physicalPath, FileMode.Create, FileAccess.Write))
        {
            await file.CopyToAsync(stream, ct);
        }

        return $"/uploads/{folder}/{safeFileName}";
    }

    public async Task<BusinessProfileDto> RemoveLogoAsync(CancellationToken ct = default)
    {
        var profile = await GetOrCreateProfileEntityAsync(ct);
        var previousLogo = profile.LogoPath;
        profile.LogoPath = null;
        profile.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        // Safely cleanup the previous custom logo
        SafeDeleteOldCustomLogo(previousLogo);

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

    private static bool IsValidImageHeader(Stream stream, string extension)
    {
        if (stream.CanSeek)
        {
            stream.Position = 0;
        }

        var header = new byte[12];
        var bytesRead = stream.Read(header, 0, header.Length);
        if (stream.CanSeek)
        {
            stream.Position = 0;
        }

        if (bytesRead < 3) return false;

        return extension switch
        {
            ".png" => bytesRead >= 8
                && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47
                && header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A,
            ".jpg" or ".jpeg" => bytesRead >= 3
                && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF,
            ".webp" => bytesRead >= 12
                && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46 // RIFF
                && header[8] == 0x57 && header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50, // WEBP
            _ => false
        };
    }

    private void SafeDeleteOldCustomLogo(string? oldRelativeUrl) =>
        SafeDeleteOwnUpload(oldRelativeUrl, "uploads/logos/", "logo_");

    /// <summary>Deletes a previous upload, but only a file this service created (right folder, right name prefix).</summary>
    private void SafeDeleteOwnUpload(string? oldRelativeUrl, string folderMarker, string namePrefix)
    {
        if (string.IsNullOrWhiteSpace(oldRelativeUrl)) return;

        var normalized = oldRelativeUrl.Trim().Replace('\\', '/');
        if (normalized.Contains(folderMarker, StringComparison.OrdinalIgnoreCase) &&
            normalized.Contains(namePrefix, StringComparison.OrdinalIgnoreCase))
        {
            var webRoot = _environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var relativePart = normalized.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var physicalPath = Path.Combine(webRoot, relativePart);

            try
            {
                if (File.Exists(physicalPath))
                {
                    File.Delete(physicalPath);
                }
            }
            catch (Exception ex)
            {
                Serilog.Log.Warning(ex, "Failed to clean up old uploaded file: {Path}", physicalPath);
            }
        }
    }

    private async Task<BusinessProfile> GetOrCreateProfileEntityAsync(CancellationToken ct)
    {
        var profile = await _db.BusinessProfiles
            .FirstOrDefaultAsync(b => b.SingletonKey == 1 && !b.IsDeleted, ct);

        if (profile != null) return profile;

        var defaultProfileSection = _configuration?.GetSection("DefaultBusinessProfile");

        // A new database starts with an empty profile (or whatever the deployment's DefaultBusinessProfile configuration
        // provides). Nothing company-specific is built into the code: the company fills in Company Settings.
        profile = new BusinessProfile
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            BusinessName = defaultProfileSection?["BusinessName"] ?? string.Empty,
            AddressLine1 = defaultProfileSection?["AddressLine1"] ?? string.Empty,
            AddressLine2 = defaultProfileSection?["AddressLine2"],
            City = defaultProfileSection?["City"] ?? string.Empty,
            State = defaultProfileSection?["State"] ?? string.Empty,
            PostalCode = defaultProfileSection?["PostalCode"] ?? string.Empty,
            Phone = defaultProfileSection?["Phone"] ?? string.Empty,
            Email = defaultProfileSection?["Email"] ?? string.Empty,
            Gstin = defaultProfileSection?["Gstin"],
            LogoPath = defaultProfileSection?["LogoPath"],
            Tagline = defaultProfileSection?["Tagline"],
            BrandColor = NormalizeBrandColorOrNull(defaultProfileSection?["BrandColor"]),
            InvoicePrefix = defaultProfileSection?["InvoicePrefix"] ?? "INV",
            CreatedAt = DateTime.UtcNow
        };

        _db.BusinessProfiles.Add(profile);
        await _db.SaveChangesAsync(ct);

        return profile;
    }

    private static string? NormalizeBrandColorOrNull(string? value)
    {
        try { return NormalizeBrandColor(value); }
        catch (ValidationException) { return null; }
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
        b.UpdatedAt,
        b.Tagline,
        b.BrandColor,
        b.AppColor,
        b.SidebarColor,
        b.LoginImagePath
    );
}
