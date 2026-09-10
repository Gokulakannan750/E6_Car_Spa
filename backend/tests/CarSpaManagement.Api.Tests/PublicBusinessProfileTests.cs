using System.Reflection;
using CarSpaManagement.Api.Application.DTOs.Settings;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class PublicBusinessProfileTests
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

    private static AppDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task GetPublicProfileAsync_ReturnsOnlyPublicBrandingFields()
    {
        using var db = CreateInMemoryDb();
        var env = new TestWebHostEnvironment();
        var audit = new NullAuditLogService();

        var profile = new BusinessProfile
        {
            SingletonKey = 1,
            BusinessName = "Custom Detailing Spa",
            AddressLine1 = "123 Main Street",
            City = "Coimbatore",
            State = "Tamil Nadu",
            PostalCode = "641001",
            Phone = "9876543210",
            Email = "custom@example.com",
            Gstin = "33AAAAA0000A1Z5",
            LogoPath = "/uploads/logos/logo_brand_123.png",
            InvoicePrefix = "CUSTOM-INV",
            TermsAndConditions = "Internal terms",
            UpdatedAt = DateTime.UtcNow
        };
        db.BusinessProfiles.Add(profile);
        await db.SaveChangesAsync();

        var service = new BusinessProfileService(db, env, audit);
        var publicProfile = await service.GetPublicProfileAsync();

        Assert.NotNull(publicProfile);
        Assert.Equal("Custom Detailing Spa", publicProfile.BusinessName);
        Assert.Equal("/uploads/logos/logo_brand_123.png", publicProfile.LogoPath);
        Assert.NotNull(publicProfile.UpdatedAt);

        // Security check: Verify type does NOT expose sensitive internal fields
        var properties = typeof(PublicBusinessProfileDto).GetProperties().Select(p => p.Name).ToList();
        Assert.DoesNotContain("Gstin", properties);
        Assert.DoesNotContain("InvoicePrefix", properties);
        Assert.DoesNotContain("TermsAndConditions", properties);
        Assert.DoesNotContain("Id", properties);
        Assert.DoesNotContain("SingletonKey", properties);
        Assert.DoesNotContain("Email", properties);
        Assert.DoesNotContain("Phone", properties);
        Assert.DoesNotContain("AddressLine1", properties);
    }

    [Fact]
    public void PublicBusinessProfileController_IsAnonymousAndHasCorrectRoute()
    {
        var type = typeof(PublicBusinessProfileController);
        var routeAttr = type.GetCustomAttribute<RouteAttribute>();
        var allowAnonymousAttr = type.GetCustomAttribute<AllowAnonymousAttribute>();

        Assert.NotNull(routeAttr);
        Assert.Equal("api/public/business-profile", routeAttr.Template);
        Assert.NotNull(allowAnonymousAttr);
    }

    [Fact]
    public void BusinessProfileController_GetProfile_RetainsRequirePermissionAttribute()
    {
        var method = typeof(BusinessProfileController).GetMethod(nameof(BusinessProfileController.GetProfile));
        Assert.NotNull(method);

        var permAttr = method.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(permAttr);
        Assert.Equal("Permission:settings.view", permAttr.Policy);

        var allowAnon = method.GetCustomAttribute<AllowAnonymousAttribute>();
        Assert.Null(allowAnon);
    }

    private class FakeBusinessProfileService : IBusinessProfileService
    {
        public Task<BusinessProfileDto> GetProfileAsync(CancellationToken ct = default) => throw new NotImplementedException();
        public Task<BusinessProfileDto> UpdateProfileAsync(UpdateBusinessProfileRequest request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<LogoUploadResponse> UploadLogoAsync(IFormFile file, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<BusinessProfileDto> RemoveLogoAsync(CancellationToken ct = default) => throw new NotImplementedException();
        public Task<PublicBusinessProfileDto> GetPublicProfileAsync(CancellationToken ct = default)
        {
            return Task.FromResult(new PublicBusinessProfileDto("E6 Car Spa", "/uploads/logos/logo.png", DateTime.UtcNow));
        }
    }

    [Fact]
    public async Task PublicBusinessProfileController_ReturnsOkWithProfile()
    {
        var fakeService = new FakeBusinessProfileService();
        var controller = new PublicBusinessProfileController(fakeService);
        var result = await controller.GetPublicProfile(default);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<PublicBusinessProfileDto>(okResult.Value);
        Assert.Equal("E6 Car Spa", dto.BusinessName);
        Assert.Equal("/uploads/logos/logo.png", dto.LogoPath);
    }
}
