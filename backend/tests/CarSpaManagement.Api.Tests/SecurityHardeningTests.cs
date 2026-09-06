using System.Reflection;
using System.Text;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class SecurityHardeningTests
{
    private class TestWebHostEnvironment : IWebHostEnvironment
    {
        public string WebRootPath { get; set; } = string.Empty;
        public IFileProvider WebRootFileProvider { get; set; } = null!;
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "CarSpaManagement.Api";
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
    }

    private class NullAuditLogService : IAuditLogService
    {
        public Task RecordAsync(
            string action,
            string module,
            string description,
            Guid? userId = null,
            string? userName = null,
            string? userRole = null,
            string? entityType = null,
            Guid? entityId = null,
            string? entityReference = null,
            string? oldValues = null,
            string? newValues = null,
            string? metadata = null,
            string outcome = "Success",
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public Task<Application.DTOs.Audit.PagedResult<Application.DTOs.Audit.AuditLogDto>> GetLogsAsync(
            Application.DTOs.Audit.AuditLogQueryParameters query,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new Application.DTOs.Audit.PagedResult<Application.DTOs.Audit.AuditLogDto>());
        }
    }

    private static AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static IFormFile CreateFormFile(byte[] content, string fileName, string contentType)
    {
        var stream = new MemoryStream(content);
        return new FormFile(stream, 0, content.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    [Fact]
    public void BusinessProfileController_UploadLogo_HasRequestSizeLimitAttribute()
    {
        var method = typeof(BusinessProfileController).GetMethod(nameof(BusinessProfileController.UploadLogo));
        Assert.NotNull(method);

        var sizeLimitAttr = method.GetCustomAttribute<RequestSizeLimitAttribute>();
        Assert.NotNull(sizeLimitAttr);
        var metadata = (Microsoft.AspNetCore.Http.Metadata.IRequestSizeLimitMetadata)sizeLimitAttr;
        Assert.Equal(5 * 1024 * 1024, metadata.MaxRequestBodySize);

        var formLimitsAttr = method.GetCustomAttribute<RequestFormLimitsAttribute>();
        Assert.NotNull(formLimitsAttr);
        Assert.Equal(5 * 1024 * 1024, formLimitsAttr.MultipartBodyLengthLimit);
    }

    [Fact]
    public async Task UploadLogo_ValidPng_PassesMagicByteValidation()
    {
        using var db = CreateInMemoryDbContext();
        var tempDir = Path.Combine(Path.GetTempPath(), "CarSpaTest_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        var env = new TestWebHostEnvironment { WebRootPath = tempDir };
        var audit = new NullAuditLogService();
        var service = new BusinessProfileService(db, env, audit);

        // Valid PNG header: 89 50 4E 47 0D 0A 1A 0A + dummy payload
        var pngBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D };
        var file = CreateFormFile(pngBytes, "valid_logo.png", "image/png");

        var response = await service.UploadLogoAsync(file);

        Assert.NotNull(response);
        Assert.NotNull(response.LogoUrl);
        Assert.StartsWith("/uploads/logos/logo_", response.LogoUrl);

        // Cleanup
        if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
    }

    [Fact]
    public async Task UploadLogo_ValidJpeg_PassesMagicByteValidation()
    {
        using var db = CreateInMemoryDbContext();
        var tempDir = Path.Combine(Path.GetTempPath(), "CarSpaTest_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        var env = new TestWebHostEnvironment { WebRootPath = tempDir };
        var audit = new NullAuditLogService();
        var service = new BusinessProfileService(db, env, audit);

        // Valid JPEG header: FF D8 FF E0 + dummy payload
        var jpegBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01 };
        var file = CreateFormFile(jpegBytes, "valid_logo.jpg", "image/jpeg");

        var response = await service.UploadLogoAsync(file);

        Assert.NotNull(response);
        Assert.StartsWith("/uploads/logos/logo_", response.LogoUrl);

        // Cleanup
        if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
    }

    [Fact]
    public async Task UploadLogo_ValidWebP_PassesMagicByteValidation()
    {
        using var db = CreateInMemoryDbContext();
        var tempDir = Path.Combine(Path.GetTempPath(), "CarSpaTest_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        var env = new TestWebHostEnvironment { WebRootPath = tempDir };
        var audit = new NullAuditLogService();
        var service = new BusinessProfileService(db, env, audit);

        // Valid WebP header: 52 49 46 46 (RIFF), 4 bytes size, 57 45 42 50 (WEBP)
        var webpBytes = new byte[] {
            0x52, 0x49, 0x46, 0x46, // RIFF
            0x24, 0x00, 0x00, 0x00, // Size
            0x57, 0x45, 0x42, 0x50  // WEBP
        };
        var file = CreateFormFile(webpBytes, "valid_logo.webp", "image/webp");

        var response = await service.UploadLogoAsync(file);

        Assert.NotNull(response);
        Assert.StartsWith("/uploads/logos/logo_", response.LogoUrl);

        // Cleanup
        if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
    }

    [Fact]
    public async Task UploadLogo_DisguisedExecutableOrText_ThrowsValidationException()
    {
        using var db = CreateInMemoryDbContext();
        var tempDir = Path.Combine(Path.GetTempPath(), "CarSpaTest_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        var env = new TestWebHostEnvironment { WebRootPath = tempDir };
        var audit = new NullAuditLogService();
        var service = new BusinessProfileService(db, env, audit);

        // Fake image with text/script content
        var fakeBytes = Encoding.UTF8.GetBytes("<?php echo 'malicious code'; ?>");
        var file = CreateFormFile(fakeBytes, "malicious.png", "image/png");

        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.UploadLogoAsync(file));
        Assert.Contains("signature does not match", ex.Message, StringComparison.OrdinalIgnoreCase);

        // Cleanup
        if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
    }

    [Fact]
    public async Task SafeDeleteOldCustomLogo_DoesNotDeleteDefaultSeedLogo()
    {
        using var db = CreateInMemoryDbContext();
        var tempDir = Path.Combine(Path.GetTempPath(), "CarSpaTest_" + Guid.NewGuid().ToString("N"));
        var logosDir = Path.Combine(tempDir, "uploads", "logos");
        Directory.CreateDirectory(logosDir);
        var env = new TestWebHostEnvironment { WebRootPath = tempDir };
        var audit = new NullAuditLogService();

        // Create mock default seed logo file
        var defaultLogoPath = Path.Combine(logosDir, "e6-logo.png");
        await File.WriteAllBytesAsync(defaultLogoPath, new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A });

        var profile = new BusinessProfile
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            BusinessName = "E6 Car Spa",
            LogoPath = "/uploads/logos/e6-logo.png",
            CreatedAt = DateTime.UtcNow
        };
        db.BusinessProfiles.Add(profile);
        await db.SaveChangesAsync();

        var service = new BusinessProfileService(db, env, audit);

        // Remove logo (sets LogoPath to null)
        await service.RemoveLogoAsync();

        // Default logo must still exist!
        Assert.True(File.Exists(defaultLogoPath));

        // Cleanup
        if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
    }

    [Fact]
    public async Task SafeDeleteOldCustomLogo_CleansUpPreviousCustomLogoOnReplacement()
    {
        using var db = CreateInMemoryDbContext();
        var tempDir = Path.Combine(Path.GetTempPath(), "CarSpaTest_" + Guid.NewGuid().ToString("N"));
        var logosDir = Path.Combine(tempDir, "uploads", "logos");
        Directory.CreateDirectory(logosDir);
        var env = new TestWebHostEnvironment { WebRootPath = tempDir };
        var audit = new NullAuditLogService();
        var service = new BusinessProfileService(db, env, audit);

        // 1. Upload first custom logo
        var pngBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D };
        var file1 = CreateFormFile(pngBytes, "logo1.png", "image/png");
        var res1 = await service.UploadLogoAsync(file1);

        var file1Name = Path.GetFileName(res1.LogoUrl);
        var file1PhysicalPath = Path.Combine(logosDir, file1Name);
        Assert.True(File.Exists(file1PhysicalPath));

        // 2. Upload second custom logo
        var file2 = CreateFormFile(pngBytes, "logo2.png", "image/png");
        var res2 = await service.UploadLogoAsync(file2);

        var file2Name = Path.GetFileName(res2.LogoUrl);
        var file2PhysicalPath = Path.Combine(logosDir, file2Name);
        Assert.True(File.Exists(file2PhysicalPath));

        // First custom logo must be deleted to prevent disk buildup
        Assert.False(File.Exists(file1PhysicalPath));

        // Cleanup
        if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
    }
}
