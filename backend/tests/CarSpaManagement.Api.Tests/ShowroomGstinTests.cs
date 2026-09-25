using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class ShowroomGstinTests
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

    private static (AppDbContext db, IShowroomService showroomService) CreateTestContext()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName)
                   .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

        services.AddSingleton<IAuditLogService, DummyAuditLogService>();
        services.AddScoped<IShowroomService, ShowroomService>();

        var provider = services.BuildServiceProvider();
        var db = provider.GetRequiredService<AppDbContext>();
        var showroomService = provider.GetRequiredService<IShowroomService>();

        return (db, showroomService);
    }

    [Fact]
    public async Task CreateAsync_WithValidGstin_SavesAndNormalizesToUppercase()
    {
        var (db, service) = CreateTestContext();

        var request = new CreateShowroomRequest
        {
            Name = "Salem Hyundai",
            Address = "Five Roads, Salem",
            Phone = "9876543210",
            Gstin = "33aaaaa0000a1z5" // Lowercase input
        };

        var result = await service.CreateAsync(request);

        Assert.NotNull(result);
        Assert.Equal("33AAAAA0000A1Z5", result.Gstin);

        var entity = await db.Showrooms.FindAsync(result.Id);
        Assert.NotNull(entity);
        Assert.Equal("33AAAAA0000A1Z5", entity.Gstin);
    }

    [Theory]
    [InlineData("INVALID123")]
    [InlineData("123456789012345")]
    [InlineData("33AAAAA0000A1Z")] // 14 chars
    [InlineData("33AAAAA0000A1Z55")] // 16 chars
    public async Task CreateAsync_WithInvalidGstin_ThrowsArgumentException(string invalidGstin)
    {
        var (_, service) = CreateTestContext();

        var request = new CreateShowroomRequest
        {
            Name = "Salem Hyundai",
            Address = "Five Roads, Salem",
            Gstin = invalidGstin
        };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.CreateAsync(request));
        Assert.Contains("Invalid Indian GSTIN structure", ex.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateAsync_WithEmptyOrWhitespaceGstin_SavesAsNull(string? emptyGstin)
    {
        var (db, service) = CreateTestContext();

        var request = new CreateShowroomRequest
        {
            Name = "Salem Hyundai",
            Address = "Five Roads, Salem",
            Gstin = emptyGstin
        };

        var result = await service.CreateAsync(request);

        Assert.NotNull(result);
        Assert.Null(result.Gstin);

        var entity = await db.Showrooms.FindAsync(result.Id);
        Assert.NotNull(entity);
        Assert.Null(entity.Gstin);
    }

    [Fact]
    public async Task UpdateAsync_CanUpdateAndClearGstin()
    {
        var (db, service) = CreateTestContext();

        var created = await service.CreateAsync(new CreateShowroomRequest
        {
            Name = "Coimbatore Motors",
            Address = "Avinashi Road, Coimbatore",
            Gstin = "33BBBBB1111B2Z6"
        });

        Assert.Equal("33BBBBB1111B2Z6", created.Gstin);

        // Update to new GSTIN
        var updated = await service.UpdateAsync(created.Id, new UpdateShowroomRequest
        {
            Gstin = "33CCCCC2222C3Z7"
        });

        Assert.NotNull(updated);
        Assert.Equal("33CCCCC2222C3Z7", updated.Gstin);

        // Clear GSTIN with empty string
        var cleared = await service.UpdateAsync(created.Id, new UpdateShowroomRequest
        {
            Gstin = ""
        });

        Assert.NotNull(cleared);
        Assert.Null(cleared.Gstin);
    }

    [Fact]
    public async Task Controller_Create_ReturnsBadRequest_WhenGstinInvalid()
    {
        var (db, service) = CreateTestContext();
        var controller = new ShowroomsController(service, db);

        var request = new CreateShowroomRequest
        {
            Name = "Invalid GST Showroom",
            Address = "Test Address",
            Gstin = "INVALID_GST"
        };

        var actionResult = await controller.Create(request, default);

        var badRequest = Assert.IsType<BadRequestObjectResult>(actionResult);
        Assert.NotNull(badRequest.Value);
    }
}
