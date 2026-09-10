using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Services;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class CatalogueDurationCompatibilityTests
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
    public async Task ExistingService_WithStoredDuration_DeserializesAndLoadsCorrectly()
    {
        var (db, serviceService) = CreateTestServices();

        var serviceId = Guid.NewGuid();
        db.Services.Add(new Service
        {
            Id = serviceId,
            Name = "Ceramic Coating Legacy",
            Category = "Protection Packages",
            Price = 25000m,
            TaxPercentage = 18m,
            DurationMinutes = 180,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var dto = await serviceService.GetByIdAsync(serviceId);

        Assert.NotNull(dto);
        Assert.Equal(serviceId, dto.Id);
        Assert.Equal(180, dto.DurationMinutes);
        Assert.Equal("Ceramic Coating Legacy", dto.Name);
    }

    [Fact]
    public async Task CreateAsync_WithoutDuration_SucceedsWithNullDuration()
    {
        var (db, serviceService) = CreateTestServices();

        var request = new CreateServiceRequest
        {
            Name = "Basic Foam Wash",
            Category = "Exterior Detailing",
            Price = 450m,
            TaxPercentage = 18m,
            DurationMinutes = null,
            IsActive = true
        };

        var created = await serviceService.CreateAsync(request);

        Assert.NotNull(created);
        Assert.Equal("Basic Foam Wash", created.Name);
        Assert.Equal(450m, created.Price);
        Assert.Null(created.DurationMinutes);

        var saved = await db.Services.FindAsync(created.Id);
        Assert.NotNull(saved);
        Assert.Null(saved.DurationMinutes);
    }

    [Fact]
    public async Task UpdateAsync_WithoutDuration_PreservesExistingStoredDuration()
    {
        var (db, serviceService) = CreateTestServices();

        var serviceId = Guid.NewGuid();
        db.Services.Add(new Service
        {
            Id = serviceId,
            Name = "Premium Interior Spa",
            Category = "Interior Care",
            Price = 3500m,
            TaxPercentage = 18m,
            DurationMinutes = 90,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        // Update name and price WITHOUT sending duration (DurationMinutes is null in request)
        var updateRequest = new UpdateServiceRequest
        {
            Name = "Premium Interior Spa Deluxe",
            Category = "Interior Care",
            Price = 4000m,
            TaxPercentage = 18m,
            DurationMinutes = null,
            IsActive = true
        };

        var updated = await serviceService.UpdateAsync(serviceId, updateRequest);

        Assert.NotNull(updated);
        Assert.Equal("Premium Interior Spa Deluxe", updated.Name);
        Assert.Equal(4000m, updated.Price);
        // Stored duration must be preserved!
        Assert.Equal(90, updated.DurationMinutes);

        var saved = await db.Services.FindAsync(serviceId);
        Assert.NotNull(saved);
        Assert.Equal(90, saved.DurationMinutes);
    }

    [Fact]
    public async Task UpdateAsync_WithExplicitDuration_UpdatesDuration()
    {
        var (db, serviceService) = CreateTestServices();

        var serviceId = Guid.NewGuid();
        db.Services.Add(new Service
        {
            Id = serviceId,
            Name = "General Inspection",
            Category = "General Services",
            Price = 800m,
            TaxPercentage = 18m,
            DurationMinutes = 30,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var updateRequest = new UpdateServiceRequest
        {
            Name = "General Inspection Extended",
            Category = "General Services",
            Price = 1200m,
            TaxPercentage = 18m,
            DurationMinutes = 60,
            IsActive = true
        };

        var updated = await serviceService.UpdateAsync(serviceId, updateRequest);

        Assert.NotNull(updated);
        Assert.Equal(60, updated.DurationMinutes);

        var saved = await db.Services.FindAsync(serviceId);
        Assert.NotNull(saved);
        Assert.Equal(60, saved.DurationMinutes);
    }
}
