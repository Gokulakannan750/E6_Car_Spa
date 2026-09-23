using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.StaffAttendance;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class StaffMonthlyAttendanceReportTests
{
    private class TestAuditLogService : IAuditLogService
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

    private static (AppDbContext db, StaffAttendanceService service) CreateTestContext()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName)
                   .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

        var audit = new TestAuditLogService();
        services.AddSingleton<IAuditLogService>(audit);
        services.AddScoped<StaffAttendanceService>();

        var provider = services.BuildServiceProvider();
        var db = provider.GetRequiredService<AppDbContext>();
        var service = provider.GetRequiredService<StaffAttendanceService>();

        return (db, service);
    }

    [Fact]
    public async Task GetMonthlyAttendanceReportAsync_ReturnsCorrectMonthBoundaries()
    {
        var (db, service) = CreateTestContext();
        var staff = new Staff { Id = Guid.NewGuid(), Name = "Ramesh", PhoneNumber = "9900000001", Role = "Detailer", IsActive = true };
        db.Staff.Add(staff);
        await db.SaveChangesAsync();

        var resSept = await service.GetMonthlyAttendanceReportAsync(2026, 9);
        Assert.Equal(2026, resSept.Year);
        Assert.Equal(9, resSept.Month);
        Assert.Equal("2026-09-01", resSept.FromDate);
        Assert.Equal("2026-09-30", resSept.ToDate);
        Assert.Equal(30, resSept.TotalCalendarDays);

        var resAug = await service.GetMonthlyAttendanceReportAsync(2026, 8);
        Assert.Equal(2026, resAug.Year);
        Assert.Equal(8, resAug.Month);
        Assert.Equal("2026-08-01", resAug.FromDate);
        Assert.Equal("2026-08-31", resAug.ToDate);
        Assert.Equal(31, resAug.TotalCalendarDays);

        var resFeb = await service.GetMonthlyAttendanceReportAsync(2026, 2);
        Assert.Equal("2026-02-01", resFeb.FromDate);
        Assert.Equal("2026-02-28", resFeb.ToDate);
        Assert.Equal(28, resFeb.TotalCalendarDays);
    }

    [Fact]
    public async Task GetMonthlyAttendanceReportAsync_StaffWithNoRecords_ShowsAllDaysUnmarked()
    {
        var (db, service) = CreateTestContext();
        var staff = new Staff { Id = Guid.NewGuid(), Name = "Suresh", PhoneNumber = "9900000002", Role = "Washer", IsActive = true };
        db.Staff.Add(staff);
        await db.SaveChangesAsync();

        var res = await service.GetMonthlyAttendanceReportAsync(2026, 9);
        Assert.Single(res.Staff);
        var item = res.Staff[0];

        Assert.Equal(0, item.PresentDays);
        Assert.Equal(0, item.HalfDays);
        Assert.Equal(0, item.LeaveDays);
        Assert.Equal(30, item.UnmarkedDays);
        Assert.Equal(0, item.AttendanceDays);
        Assert.Equal(30, item.DailyRecords.Count);
        Assert.All(item.DailyRecords, r => Assert.Equal("Unmarked", r.Status));
    }

    [Fact]
    public async Task GetMonthlyAttendanceReportAsync_StaffWithMixedAttendance_CalculatesCorrectCounts()
    {
        var (db, service) = CreateTestContext();
        var staff = new Staff { Id = Guid.NewGuid(), Name = "Karthik", PhoneNumber = "9900000003", Role = "Detailer", IsActive = true };
        db.Staff.Add(staff);

        // 20 Present days, 2 Half Day days, 3 Leave days in September 2026 (total 25 recorded days -> 5 unmarked)
        for (int day = 1; day <= 20; day++)
        {
            db.StaffAttendances.Add(new StaffAttendance
            {
                Id = Guid.NewGuid(),
                StaffId = staff.Id,
                AttendanceDate = new DateTime(2026, 9, day, 0, 0, 0, DateTimeKind.Utc),
                Status = StaffAttendanceStatus.Present,
                CheckInTime = "09:00",
                CheckOutTime = "18:00"
            });
        }
        for (int day = 21; day <= 22; day++)
        {
            db.StaffAttendances.Add(new StaffAttendance
            {
                Id = Guid.NewGuid(),
                StaffId = staff.Id,
                AttendanceDate = new DateTime(2026, 9, day, 0, 0, 0, DateTimeKind.Utc),
                Status = StaffAttendanceStatus.HalfDay,
                CheckInTime = "09:00",
                CheckOutTime = "13:30"
            });
        }
        for (int day = 23; day <= 25; day++)
        {
            db.StaffAttendances.Add(new StaffAttendance
            {
                Id = Guid.NewGuid(),
                StaffId = staff.Id,
                AttendanceDate = new DateTime(2026, 9, day, 0, 0, 0, DateTimeKind.Utc),
                Status = StaffAttendanceStatus.Leave,
                Notes = "Sick leave"
            });
        }
        await db.SaveChangesAsync();

        var res = await service.GetMonthlyAttendanceReportAsync(2026, 9);
        Assert.Single(res.Staff);
        var item = res.Staff[0];

        Assert.Equal(20, item.PresentDays);
        Assert.Equal(2, item.HalfDays);
        Assert.Equal(3, item.LeaveDays);
        Assert.Equal(5, item.UnmarkedDays); // 30 - 25 = 5
        Assert.Equal(22, item.AttendanceDays); // 20 + 2 = 22

        Assert.Equal(20, res.Summary.Present);
        Assert.Equal(2, res.Summary.HalfDay);
        Assert.Equal(3, res.Summary.Leave);
        Assert.Equal(5, res.Summary.Unmarked);
    }

    [Fact]
    public async Task GetMonthlyAttendanceReportAsync_ExcludesRecordsOutsideSelectedMonth()
    {
        var (db, service) = CreateTestContext();
        var staff = new Staff { Id = Guid.NewGuid(), Name = "Ravi", PhoneNumber = "9900000004", Role = "Manager", IsActive = true };
        db.Staff.Add(staff);

        // August record (2026-08-31)
        db.StaffAttendances.Add(new StaffAttendance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            AttendanceDate = new DateTime(2026, 8, 31, 0, 0, 0, DateTimeKind.Utc),
            Status = StaffAttendanceStatus.Present
        });

        // September records (2026-09-01 and 2026-09-02)
        db.StaffAttendances.Add(new StaffAttendance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            AttendanceDate = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
            Status = StaffAttendanceStatus.Present
        });
        db.StaffAttendances.Add(new StaffAttendance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            AttendanceDate = new DateTime(2026, 9, 2, 0, 0, 0, DateTimeKind.Utc),
            Status = StaffAttendanceStatus.Present
        });

        // October record (2026-10-01)
        db.StaffAttendances.Add(new StaffAttendance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            AttendanceDate = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc),
            Status = StaffAttendanceStatus.Present
        });
        await db.SaveChangesAsync();

        var res = await service.GetMonthlyAttendanceReportAsync(2026, 9);
        var item = res.Staff[0];
        Assert.Equal(2, item.PresentDays);
        Assert.Equal(0, item.HalfDays);
        Assert.Equal(0, item.LeaveDays);
        Assert.Equal(28, item.UnmarkedDays);
    }

    [Fact]
    public async Task GetMonthlyAttendanceReportAsync_SearchFilter_FiltersByNameAndRole()
    {
        var (db, service) = CreateTestContext();
        db.Staff.Add(new Staff { Id = Guid.NewGuid(), Name = "Manoj Kumar", PhoneNumber = "9876543210", Role = "Technician", IsActive = true });
        db.Staff.Add(new Staff { Id = Guid.NewGuid(), Name = "Praveen Raj", PhoneNumber = "9876543211", Role = "Supervisor", IsActive = true });
        await db.SaveChangesAsync();

        // Search by name
        var searchName = await service.GetMonthlyAttendanceReportAsync(2026, 9, search: "Manoj");
        Assert.Single(searchName.Staff);
        Assert.Equal("Manoj Kumar", searchName.Staff[0].Name);

        // Search by role
        var searchRole = await service.GetMonthlyAttendanceReportAsync(2026, 9, search: "Supervisor");
        Assert.Single(searchRole.Staff);
        Assert.Equal("Praveen Raj", searchRole.Staff[0].Name);
    }

    [Fact]
    public async Task GetMonthlyAttendanceReportAsync_StaffIdFilter_ReturnsSingleStaff()
    {
        var (db, service) = CreateTestContext();
        var staff1 = new Staff { Id = Guid.NewGuid(), Name = "Staff One", PhoneNumber = "9876543201", Role = "Detailer", IsActive = true };
        var staff2 = new Staff { Id = Guid.NewGuid(), Name = "Staff Two", PhoneNumber = "9876543202", Role = "Detailer", IsActive = true };
        db.Staff.AddRange(staff1, staff2);
        await db.SaveChangesAsync();

        var res = await service.GetMonthlyAttendanceReportAsync(2026, 9, staffId: staff1.Id);
        Assert.Single(res.Staff);
        Assert.Equal(staff1.Id, res.Staff[0].StaffId);
    }

    [Fact]
    public async Task GetMonthlyAttendanceReportAsync_StatusFilter_FiltersDerivedUnmarkedCorrectly()
    {
        var (db, service) = CreateTestContext();
        var staffAllMarked = new Staff { Id = Guid.NewGuid(), Name = "Full Attendance Staff", PhoneNumber = "9876543203", Role = "Detailer", IsActive = true };
        var staffUnmarkedOnly = new Staff { Id = Guid.NewGuid(), Name = "Unmarked Staff", PhoneNumber = "9876543204", Role = "Detailer", IsActive = true };
        db.Staff.AddRange(staffAllMarked, staffUnmarkedOnly);

        // Mark all 30 days for staffAllMarked in September
        for (int day = 1; day <= 30; day++)
        {
            db.StaffAttendances.Add(new StaffAttendance
            {
                Id = Guid.NewGuid(),
                StaffId = staffAllMarked.Id,
                AttendanceDate = new DateTime(2026, 9, day, 0, 0, 0, DateTimeKind.Utc),
                Status = StaffAttendanceStatus.Present
            });
        }
        await db.SaveChangesAsync();

        // Filter by Unmarked: should return staffUnmarkedOnly (30 unmarked days), but NOT staffAllMarked (0 unmarked days)
        var filterUnmarked = await service.GetMonthlyAttendanceReportAsync(2026, 9, status: "Unmarked");
        Assert.Single(filterUnmarked.Staff);
        Assert.Equal(staffUnmarkedOnly.Id, filterUnmarked.Staff[0].StaffId);

        // Filter by Present: should return staffAllMarked (30 present days)
        var filterPresent = await service.GetMonthlyAttendanceReportAsync(2026, 9, status: "Present");
        Assert.Single(filterPresent.Staff);
        Assert.Equal(staffAllMarked.Id, filterPresent.Staff[0].StaffId);
    }

    [Fact]
    public async Task GetMonthlyAttendanceReportAsync_ExcludesInactiveStaff()
    {
        var (db, service) = CreateTestContext();
        var activeStaff = new Staff { Id = Guid.NewGuid(), Name = "Active Staff", PhoneNumber = "9876543205", Role = "Detailer", IsActive = true };
        var inactiveStaff = new Staff { Id = Guid.NewGuid(), Name = "Inactive Staff", PhoneNumber = "9876543206", Role = "Detailer", IsActive = false };
        var deletedStaff = new Staff { Id = Guid.NewGuid(), Name = "Deleted Staff", PhoneNumber = "9876543207", Role = "Detailer", IsActive = true, IsDeleted = true };
        db.Staff.AddRange(activeStaff, inactiveStaff, deletedStaff);
        await db.SaveChangesAsync();

        var res = await service.GetMonthlyAttendanceReportAsync(2026, 9);
        Assert.Single(res.Staff);
        Assert.Equal("Active Staff", res.Staff[0].Name);
    }

    [Fact]
    public void StaffAttendanceController_MonthlyReportEndpoint_RequiresStaffAttendanceViewPermission()
    {
        var method = typeof(StaffAttendanceController).GetMethod(nameof(StaffAttendanceController.GetMonthlyReport));
        Assert.NotNull(method);

        var attr = (RequirePermissionAttribute?)Attribute.GetCustomAttribute(method, typeof(RequirePermissionAttribute));
        Assert.NotNull(attr);
        Assert.Equal("Permission:staff_attendance.view", attr.Policy);
    }
}
