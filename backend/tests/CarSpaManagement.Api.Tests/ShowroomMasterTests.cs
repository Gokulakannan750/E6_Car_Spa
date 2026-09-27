using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class ShowroomMasterTests
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

    [Theory]
    [InlineData("Skoda", "SK")]
    [InlineData("Honda", "HO")]
    [InlineData("Toyota", "TO")]
    [InlineData("Mahindra", "MA")]
    [InlineData("Popular Hyundai Showroom", "PO")]
    [InlineData("   BMW   ", "BM")]
    [InlineData("123 Audi", "AU")]
    [InlineData("A", "AX")]
    [InlineData("12345", "SR")]
    public void DerivePrefix_DerivesCorrectTwoLetterUppercasePrefix(string input, string expectedPrefix)
    {
        var prefix = ShowroomService.DerivePrefix(input);
        Assert.Equal(expectedPrefix, prefix);
    }

    [Fact]
    public async Task CreateAsync_GeneratesMasterId_MatchingRequiredFormat()
    {
        var (_, service) = CreateTestContext();

        var request = new CreateShowroomRequest
        {
            Name = "Skoda Erode",
            Address = "Perundurai Road, Erode",
            Phone = "9876543210"
        };

        var result = await service.CreateAsync(request);

        Assert.NotNull(result);
        Assert.Matches(@"^[A-Z]{2}[0-9]{5}$", result.MasterId);
        Assert.StartsWith("SK", result.MasterId);
        Assert.Equal(7, result.MasterId.Length);
    }

    [Fact]
    public async Task CreateAsync_IncrementsNumericPortionPerPrefix_StartingAt10001()
    {
        var (_, service) = CreateTestContext();

        var first = await service.CreateAsync(new CreateShowroomRequest
        {
            Name = "Honda Salem",
            Address = "Junction Road, Salem"
        });

        var second = await service.CreateAsync(new CreateShowroomRequest
        {
            Name = "Honda Namakkal",
            Address = "Main Road, Namakkal"
        });

        var third = await service.CreateAsync(new CreateShowroomRequest
        {
            Name = "Honda Coimbatore",
            Address = "Avinashi Road, Coimbatore"
        });

        Assert.Equal("HO10001", first.MasterId);
        Assert.Equal("HO10002", second.MasterId);
        Assert.Equal("HO10003", third.MasterId);
    }

    [Fact]
    public async Task CreateAsync_DifferentPrefixes_EachStartAt10001()
    {
        var (_, service) = CreateTestContext();

        var skoda = await service.CreateAsync(new CreateShowroomRequest
        {
            Name = "Skoda Chennai",
            Address = "Mount Road, Chennai"
        });

        var toyota = await service.CreateAsync(new CreateShowroomRequest
        {
            Name = "Toyota Bangalore",
            Address = "Hosur Road, Bangalore"
        });

        Assert.Equal("SK10001", skoda.MasterId);
        Assert.Equal("TO10001", toyota.MasterId);
    }

    [Fact]
    public async Task UpdateAsync_RenamingShowroom_DoesNotChangeMasterId()
    {
        var (_, service) = CreateTestContext();

        var created = await service.CreateAsync(new CreateShowroomRequest
        {
            Name = "Skoda",
            Address = "Erode Bypass"
        });

        var originalMasterId = created.MasterId;
        Assert.Equal("SK10001", originalMasterId);

        // Rename the showroom to something with a completely different prefix
        var updated = await service.UpdateAsync(created.Id, new UpdateShowroomRequest
        {
            Name = "Volkswagen & Skoda Erode"
        });

        Assert.NotNull(updated);
        Assert.Equal("Volkswagen & Skoda Erode", updated.Name);
        Assert.Equal(originalMasterId, updated.MasterId); // MasterId MUST remain permanent
    }

    [Fact]
    public async Task Showroom_GuidIdentityAndForeignKeys_RemainIntact()
    {
        var (db, service) = CreateTestContext();

        var created = await service.CreateAsync(new CreateShowroomRequest
        {
            Name = "Popular Hyundai",
            Address = "Anna Salai, Chennai"
        });

        // Verify Guid Id is the primary key
        Assert.NotEqual(Guid.Empty, created.Id);

        // Add a foreign key relationship to ShowroomStaffAssignment
        var assignment = new ShowroomStaffAssignment
        {
            ShowroomId = created.Id,
            StaffId = Guid.NewGuid(),
            Date = DateTime.UtcNow.Date,
            VehiclesAttended = 4
        };

        db.ShowroomStaffAssignments.Add(assignment);
        await db.SaveChangesAsync();

        var savedAssignment = await db.ShowroomStaffAssignments
            .FirstOrDefaultAsync(a => a.ShowroomId == created.Id);

        Assert.NotNull(savedAssignment);
        Assert.Equal(created.Id, savedAssignment.ShowroomId);
    }

    [Fact]
    public void ShowroomsController_DoesNotHaveDeleteEndpoint()
    {
        var controllerType = typeof(ShowroomsController);
        var methods = controllerType.GetMethods();

        var httpDeleteMethods = methods
            .Where(m => m.GetCustomAttributes(typeof(HttpDeleteAttribute), inherit: false).Any())
            .ToList();

        // Must NOT have any HttpDelete showroom endpoint
        Assert.Empty(httpDeleteMethods);
    }

    [Fact]
    public async Task GetAllAsync_And_GetByIdAsync_CalculateActiveStaffAndVehicles_FromWorkSessions()
    {
        var (db, service) = CreateTestContext();

        var showroom = await service.CreateAsync(new CreateShowroomRequest
        {
            Name = "Maruti Nexa",
            Address = "MG Road, Bangalore"
        });

        var today = CarSpaManagement.Api.Application.Common.ShowroomDateHelper.GetTodayUtc();
        var dummyVehicleTypeId = Guid.NewGuid();

        // Add 6 active staff work sessions on today
        for (int i = 1; i <= 6; i++)
        {
            db.ShowroomStaffWorkSessions.Add(new ShowroomStaffWorkSession
            {
                Id = Guid.NewGuid(),
                StaffId = Guid.NewGuid(),
                HomeShowroomId = showroom.Id,
                WorkingShowroomId = showroom.Id,
                Date = today,
                AttendanceStatus = StaffAttendanceStatus.Present,
                StartTime = "09:00",
                EndTime = "18:00"
            });
        }

        // Add 1 Leave and 1 Absent (must be excluded)
        db.ShowroomStaffWorkSessions.Add(new ShowroomStaffWorkSession
        {
            Id = Guid.NewGuid(),
            StaffId = Guid.NewGuid(),
            HomeShowroomId = showroom.Id,
            WorkingShowroomId = showroom.Id,
            Date = today,
            AttendanceStatus = StaffAttendanceStatus.Leave,
            StartTime = "09:00",
            EndTime = "18:00"
        });
        db.ShowroomStaffWorkSessions.Add(new ShowroomStaffWorkSession
        {
            Id = Guid.NewGuid(),
            StaffId = Guid.NewGuid(),
            HomeShowroomId = showroom.Id,
            WorkingShowroomId = showroom.Id,
            Date = today,
            AttendanceStatus = StaffAttendanceStatus.Absent,
            StartTime = "09:00",
            EndTime = "18:00"
        });

        // Add work session for a different date (must be excluded)
        db.ShowroomStaffWorkSessions.Add(new ShowroomStaffWorkSession
        {
            Id = Guid.NewGuid(),
            StaffId = Guid.NewGuid(),
            HomeShowroomId = showroom.Id,
            WorkingShowroomId = showroom.Id,
            Date = today.AddDays(-1),
            AttendanceStatus = StaffAttendanceStatus.Present,
            StartTime = "09:00",
            EndTime = "18:00"
        });

        // Add 2 vehicle work logs for today (3 + 4 = 7 vehicles)
        db.ShowroomVehicleWorks.Add(new ShowroomVehicleWork
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroom.Id,
            StaffId = Guid.NewGuid(),
            VehicleTypeId = dummyVehicleTypeId,
            Date = today,
            VehicleQuantity = 3
        });
        db.ShowroomVehicleWorks.Add(new ShowroomVehicleWork
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroom.Id,
            StaffId = Guid.NewGuid(),
            VehicleTypeId = dummyVehicleTypeId,
            Date = today,
            VehicleQuantity = 4
        });

        // Add vehicle work log for yesterday (must be excluded)
        db.ShowroomVehicleWorks.Add(new ShowroomVehicleWork
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroom.Id,
            StaffId = Guid.NewGuid(),
            VehicleTypeId = dummyVehicleTypeId,
            Date = today.AddDays(-1),
            VehicleQuantity = 10
        });

        await db.SaveChangesAsync();

        // 1. Check GetAllAsync
        var allShowrooms = await service.GetAllAsync();
        var maruti = allShowrooms.FirstOrDefault(s => s.Id == showroom.Id);

        Assert.NotNull(maruti);
        Assert.Equal(6, maruti.ActiveStaffCountToday);
        Assert.Equal(7, maruti.TotalVehiclesToday);

        // 2. Check GetByIdAsync
        var byId = await service.GetByIdAsync(showroom.Id);
        Assert.NotNull(byId);
        Assert.Equal(6, byId.ActiveStaffCountToday);
        Assert.Equal(7, byId.TotalVehiclesToday);
    }

    [Fact]
    public async Task GetAllAsync_FallsBackToLegacyStaffAssignments_WhenNoWorkSessions()
    {
        var (db, service) = CreateTestContext();

        var showroom = await service.CreateAsync(new CreateShowroomRequest
        {
            Name = "Hyundai Motor Plaza",
            Address = "Guindy, Chennai"
        });

        var today = CarSpaManagement.Api.Application.Common.ShowroomDateHelper.GetTodayUtc();

        // Add 3 legacy staff assignments
        for (int i = 1; i <= 3; i++)
        {
            db.ShowroomStaffAssignments.Add(new ShowroomStaffAssignment
            {
                Id = Guid.NewGuid(),
                ShowroomId = showroom.Id,
                StaffId = Guid.NewGuid(),
                Date = today,
                VehiclesAttended = 2
            });
        }

        await db.SaveChangesAsync();

        var allShowrooms = await service.GetAllAsync();
        var hyundai = allShowrooms.FirstOrDefault(s => s.Id == showroom.Id);

        Assert.NotNull(hyundai);
        Assert.Equal(3, hyundai.ActiveStaffCountToday);
        Assert.Equal(6, hyundai.TotalVehiclesToday); // 3 * 2 vehicles attended from legacy assignments
    }
}

