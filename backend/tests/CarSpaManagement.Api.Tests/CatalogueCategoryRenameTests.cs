using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class CatalogueCategoryRenameTests
{
    private class DummyAuditLogService : IAuditLogService
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

        public Task<PagedResult<AuditLogDto>> GetLogsAsync(
            AuditLogQueryParameters query,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new PagedResult<AuditLogDto>
            {
                Items = new List<AuditLogDto>(),
                TotalCount = 0,
                Page = query.Page,
                PageSize = query.PageSize
            });
        }
    }

    private static (AppDbContext db, IServiceService serviceService) CreateTestServices()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName)
                   .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

        services.AddSingleton<IAuditLogService, DummyAuditLogService>();
        services.AddScoped<IServiceService, ServiceService>();

        var provider = services.BuildServiceProvider();
        var db = provider.GetRequiredService<AppDbContext>();
        var serviceService = provider.GetRequiredService<IServiceService>();

        return (db, serviceService);
    }

    [Fact]
    public async Task GetCategoriesAsync_ReturnsGeneralServices_AndExcludesGeneralDetailing()
    {
        var (db, serviceService) = CreateTestServices();

        var serviceId = Guid.NewGuid();
        db.Services.AddRange(
            new Service
            {
                Id = serviceId,
                Name = "Android service Testing",
                Category = "General Services",
                Price = 15500.0m,
                Description = "General maintenance and inspection service",
                DurationMinutes = 60,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new Service
            {
                Id = Guid.NewGuid(),
                Name = "Ceramic Pro Gold",
                Category = "Protection Packages",
                Price = 35000.0m,
                DurationMinutes = 240,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            }
        );
        await db.SaveChangesAsync();

        var categories = await serviceService.GetCategoriesAsync();

        Assert.Contains("General Services", categories);
        Assert.DoesNotContain("General Detailing", categories);
        Assert.Contains("Protection Packages", categories);
    }

    [Fact]
    public async Task GetAllAsync_FilteredByGeneralServices_PreservesServiceProperties()
    {
        var (db, serviceService) = CreateTestServices();

        var serviceId = Guid.Parse("74b58d22-17bc-441f-ad96-e0c79fdefdc5");
        db.Services.Add(new Service
        {
            Id = serviceId,
            Name = "Android service Testing",
            Category = "General Services",
            Price = 15500.0m,
            Description = "Full multi-point checkup",
            DurationMinutes = 90,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        // 1. Fetch under General Services category
        var generalServices = await serviceService.GetAllAsync(category: "General Services");
        Assert.Single(generalServices);
        var svc = generalServices[0];

        // 2. Verify all properties are strictly preserved
        Assert.Equal(serviceId, svc.Id);
        Assert.Equal("Android service Testing", svc.Name);
        Assert.Equal("General Services", svc.Category);
        Assert.Equal(15500.0m, svc.Price);
        Assert.Equal("Full multi-point checkup", svc.Description);
        Assert.Equal(90, svc.DurationMinutes);
        Assert.True(svc.IsActive);

        // 3. Querying obsolete "General Detailing" category returns 0 services
        var legacyResults = await serviceService.GetAllAsync(category: "General Detailing");
        Assert.Empty(legacyResults);
    }

    [Fact]
    public async Task CategoryMigration_ConvertsLegacyGeneralDetailingToGeneralServices_PreservingIdAndData()
    {
        var (db, serviceService) = CreateTestServices();

        var targetId = Guid.NewGuid();
        var legacyService = new Service
        {
            Id = targetId,
            Name = "Standard Detailing Pack",
            Category = "General Detailing",
            Price = 4500.0m,
            Description = "Legacy general detailing package",
            DurationMinutes = 75,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Services.Add(legacyService);
        await db.SaveChangesAsync();

        // Simulate database migration logic (equivalent to Program.cs startup SQL update)
        var servicesToMigrate = await db.Services.Where(s => s.Category == "General Detailing").ToListAsync();
        foreach (var s in servicesToMigrate)
        {
            s.Category = "General Services";
        }
        await db.SaveChangesAsync();

        // Verify active categories no longer contain General Detailing
        var categories = await serviceService.GetCategoriesAsync();
        Assert.Contains("General Services", categories);
        Assert.DoesNotContain("General Detailing", categories);

        // Verify service preserved
        var updated = await serviceService.GetByIdAsync(targetId);
        Assert.NotNull(updated);
        Assert.Equal(targetId, updated!.Id);
        Assert.Equal("Standard Detailing Pack", updated.Name);
        Assert.Equal("General Services", updated.Category);
        Assert.Equal(4500.0m, updated.Price);
        Assert.Equal("Legacy general detailing package", updated.Description);
        Assert.Equal(75, updated.DurationMinutes);
        Assert.True(updated.IsActive);
    }
}
