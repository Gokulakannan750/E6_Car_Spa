using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.StaffAttendance;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class StaffAttendanceValidationAndLockingTests
{
    private class TestAuditLogService : IAuditLogService
    {
        public List<(string action, string module, string description, string entityType, Guid? entityId)> RecordedActions { get; } = new();

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
            RecordedActions.Add((action, module, description, entityType ?? "", entityId));
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

    private static (AppDbContext db, StaffAttendanceService service, TestAuditLogService audit) CreateTestContext()
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

        return (db, service, audit);
    }

    [Fact]
    public async Task ConfirmAttendanceAsync_ThrowsInvalidOperationException_WhenZeroStaffMarked()
    {
        var (db, service, _) = CreateTestContext();
        var targetDate = new DateTime(2026, 9, 22, 0, 0, 0, DateTimeKind.Utc);
        var userId = Guid.NewGuid();

        // Staff exists, but no attendance record created
        db.Staff.Add(new Staff
        {
            Id = Guid.NewGuid(),
            Name = "Manoj Kumar",
            PhoneNumber = "9876543210",
            Role = "Technician",
            IsActive = true
        });
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.ConfirmAttendanceAsync(targetDate, userId));

        Assert.Contains("Please mark attendance for at least one staff member", ex.Message);
    }

    [Fact]
    public async Task UpsertAttendanceAsync_AllowsPresentHalfDayLeave_AndRejectsAbsent()
    {
        var (db, service, _) = CreateTestContext();
        var targetDate = "2026-09-22";
        var userId = Guid.NewGuid();
        var staffId = Guid.NewGuid();

        db.Staff.Add(new Staff
        {
            Id = staffId,
            Name = "Suresh",
            PhoneNumber = "9876512345",
            Role = "Detailer",
            IsActive = true
        });
        await db.SaveChangesAsync();

        // 1. Present succeeds
        var resPresent = await service.UpsertAttendanceAsync(new UpsertStaffAttendanceRequest
        {
            StaffId = staffId,
            AttendanceDate = targetDate,
            Status = "Present"
        }, userId, isOwner: false);
        Assert.Equal("Present", resPresent.Status);

        // 2. HalfDay succeeds
        var resHalfDay = await service.UpsertAttendanceAsync(new UpsertStaffAttendanceRequest
        {
            StaffId = staffId,
            AttendanceDate = targetDate,
            Status = "HalfDay"
        }, userId, isOwner: false);
        Assert.Equal("HalfDay", resHalfDay.Status);

        // 3. Leave succeeds
        var resLeave = await service.UpsertAttendanceAsync(new UpsertStaffAttendanceRequest
        {
            StaffId = staffId,
            AttendanceDate = targetDate,
            Status = "Leave"
        }, userId, isOwner: false);
        Assert.Equal("Leave", resLeave.Status);

        // 4. "Absent" throws ValidationException
        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            service.UpsertAttendanceAsync(new UpsertStaffAttendanceRequest
            {
                StaffId = staffId,
                AttendanceDate = targetDate,
                Status = "Absent"
            }, userId, isOwner: false));

        Assert.Contains("Invalid attendance status 'Absent'", ex.Message);
        Assert.Contains("Valid statuses are: Present, HalfDay, Leave", ex.Message);
    }

    [Fact]
    public async Task ConfirmAttendanceAsync_LocksDate_AndOwnerCorrectionWorkflow()
    {
        var (db, service, audit) = CreateTestContext();
        var targetDate = new DateTime(2026, 9, 22, 0, 0, 0, DateTimeKind.Utc);
        var ownerId = Guid.NewGuid();
        var staffId = Guid.NewGuid();

        db.Staff.Add(new Staff
        {
            Id = staffId,
            Name = "Gokul",
            PhoneNumber = "9944123456",
            Role = "Specialist",
            IsActive = true
        });
        await db.SaveChangesAsync();

        // Mark Present
        await service.UpsertAttendanceAsync(new UpsertStaffAttendanceRequest
        {
            StaffId = staffId,
            AttendanceDate = "2026-09-22",
            Status = "Present"
        }, ownerId, isOwner: true);

        // Confirm Attendance
        var confirmRes = await service.ConfirmAttendanceAsync(targetDate, ownerId);
        Assert.True(confirmRes.IsAttendanceConfirmed);
        Assert.Contains(audit.RecordedActions, a => a.action == AuditActions.AttendanceConfirmed);

        // Non-owner modification is rejected with ForbiddenException
        var nonOwnerId = Guid.NewGuid();
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.UpsertAttendanceAsync(new UpsertStaffAttendanceRequest
            {
                StaffId = staffId,
                AttendanceDate = "2026-09-22",
                Status = "HalfDay"
            }, nonOwnerId, isOwner: false));

        // Owner direct modification before unlock throws ConflictException
        await Assert.ThrowsAsync<ConflictException>(() =>
            service.UpsertAttendanceAsync(new UpsertStaffAttendanceRequest
            {
                StaffId = staffId,
                AttendanceDate = "2026-09-22",
                Status = "HalfDay"
            }, ownerId, isOwner: true));

        // Non-owner cannot unlock
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.UnlockAttendanceAsync(targetDate, nonOwnerId, isOwner: false));

        // Owner unlocks attendance
        var unlockRes = await service.UnlockAttendanceAsync(targetDate, ownerId, isOwner: true);
        Assert.False(unlockRes.IsAttendanceConfirmed);
        Assert.Contains(audit.RecordedActions, a => a.action == AuditActions.AttendanceUnlocked);

        // Owner can now edit
        var editRes = await service.UpsertAttendanceAsync(new UpsertStaffAttendanceRequest
        {
            StaffId = staffId,
            AttendanceDate = "2026-09-22",
            Status = "Leave"
        }, ownerId, isOwner: true);
        Assert.Equal("Leave", editRes.Status);

        // Owner re-confirms attendance
        var reconfirmRes = await service.ConfirmAttendanceAsync(targetDate, ownerId);
        Assert.True(reconfirmRes.IsAttendanceConfirmed);
        Assert.Contains(audit.RecordedActions, a => a.action == AuditActions.AttendanceCorrected);
    }

    [Fact]
    public async Task InactiveStaff_AreOmittedFromDailyAndRangeAttendance()
    {
        var (db, service, _) = CreateTestContext();
        var targetDate = new DateTime(2026, 9, 22, 0, 0, 0, DateTimeKind.Utc);
        var activeStaffId = Guid.NewGuid();
        var inactiveStaffId = Guid.NewGuid();

        db.Staff.Add(new Staff
        {
            Id = activeStaffId,
            Name = "Active Staff",
            PhoneNumber = "9999911111",
            Role = "Worker",
            IsActive = true
        });
        db.Staff.Add(new Staff
        {
            Id = inactiveStaffId,
            Name = "Inactive Staff",
            PhoneNumber = "9999922222",
            Role = "Former Worker",
            IsActive = false
        });
        await db.SaveChangesAsync();

        // Get daily attendance
        var dailyRes = await service.GetDailyAttendanceAsync(targetDate);
        Assert.Contains(dailyRes.StaffMembers, s => s.StaffId == activeStaffId);
        Assert.DoesNotContain(dailyRes.StaffMembers, s => s.StaffId == inactiveStaffId);
        Assert.Equal(1, dailyRes.Summary.TotalActiveStaff);

        // Inactive staff cannot be upserted
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.UpsertAttendanceAsync(new UpsertStaffAttendanceRequest
            {
                StaffId = inactiveStaffId,
                AttendanceDate = "2026-09-22",
                Status = "Present"
            }, Guid.NewGuid(), isOwner: true));
    }

    [Fact]
    public void StaffAttendanceController_ConfirmEndpoint_RequiresStaffAttendanceConfirmPermission()
    {
        var method = typeof(StaffAttendanceController).GetMethod(nameof(StaffAttendanceController.ConfirmAttendance));
        Assert.NotNull(method);

        var attr = (RequirePermissionAttribute?)Attribute.GetCustomAttribute(method, typeof(RequirePermissionAttribute));
        Assert.NotNull(attr);
        Assert.Equal("Permission:staff_attendance.confirm", attr.Policy);
    }
}
