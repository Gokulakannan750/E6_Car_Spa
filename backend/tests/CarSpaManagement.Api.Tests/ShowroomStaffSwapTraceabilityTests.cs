using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class ShowroomStaffSwapTraceabilityTests
{
    private class TestAuditLogService : IAuditLogService
    {
        public List<(string action, string module, string description, string? metadata, string? entityReference)> RecordedLogs { get; } = new();

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
            RecordedLogs.Add((action, module, description, metadata, entityReference));
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

    private static (AppDbContext db, IShowroomService showroomService, TestAuditLogService audit) CreateTestContext()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName)
                   .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

        var audit = new TestAuditLogService();
        services.AddSingleton<IAuditLogService>(audit);
        services.AddScoped<IShowroomService, ShowroomService>();

        var provider = services.BuildServiceProvider();
        var db = provider.GetRequiredService<AppDbContext>();
        var showroomService = provider.GetRequiredService<IShowroomService>();

        return (db, showroomService, audit);
    }

    private static async Task<(Showroom showroomA, Showroom showroomB, Staff staffA, Staff staffB)> SeedShowroomsAndStaffAsync(AppDbContext db)
    {
        var showroomA = new Showroom
        {
            Id = Guid.NewGuid(),
            Name = "Maruti Nexa",
            Address = "MG Road, Bangalore",
            MasterId = "MA10001",
            IsActive = true
        };
        var showroomB = new Showroom
        {
            Id = Guid.NewGuid(),
            Name = "Honda Central",
            Address = "Indiranagar, Bangalore",
            MasterId = "HO10001",
            IsActive = true
        };
        db.Showrooms.AddRange(showroomA, showroomB);

        var staffA = new Staff
        {
            Id = Guid.NewGuid(),
            Name = "Aadhaar Test Staff A",
            StaffMasterId = "ST10001",
            PhoneNumber = "9876543210",
            Role = "Detailer",
            IsActive = true,
            DefaultShowroomId = showroomA.Id
        };
        var staffB = new Staff
        {
            Id = Guid.NewGuid(),
            Name = "Aadhaar Test Staff B",
            StaffMasterId = "ST10002",
            PhoneNumber = "9876543211",
            Role = "Washing Specialist",
            IsActive = true,
            DefaultShowroomId = showroomB.Id
        };
        db.Staff.AddRange(staffA, staffB);

        await db.SaveChangesAsync();
        return (showroomA, showroomB, staffA, staffB);
    }

    [Fact]
    public async Task SwapStaffAsync_Success_GeneratesSwapId_And_LinksBothStaffBidirectionally()
    {
        var (db, service, audit) = CreateTestContext();
        var (showroomA, showroomB, staffA, staffB) = await SeedShowroomsAndStaffAsync(db);

        var date = new DateTime(2026, 9, 27, 0, 0, 0, DateTimeKind.Utc);
        var testUserId = Guid.NewGuid();

        var request = new CreateStaffSwapRequest
        {
            Date = date,
            StaffAId = staffA.Id,
            ShowroomAId = showroomA.Id,
            StaffBId = staffB.Id,
            ShowroomBId = showroomB.Id,
            Reason = "Mutual cross-showroom support",
            Notes = "Covering for busy weekend rush"
        };

        var swapDto = await service.SwapStaffAsync(request, testUserId, isOwner: true);

        // 1. Verify Swap DTO
        Assert.NotNull(swapDto);
        Assert.StartsWith("SWP-20260927-", swapDto.SwapId);
        Assert.Equal("Completed", swapDto.Status);
        Assert.Equal(staffA.Id, swapDto.StaffAId);
        Assert.Equal(staffB.Id, swapDto.StaffBId);
        Assert.Equal(showroomA.Id, swapDto.ShowroomAId);
        Assert.Equal(showroomB.Id, swapDto.ShowroomBId);
        Assert.Equal("Mutual cross-showroom support", swapDto.Reason);

        // 2. Verify Showroom A daily staff shows Staff B (now working at Showroom A)
        var dailyStaffA = await service.GetDailyStaffAsync(showroomA.Id, date);
        Assert.NotNull(dailyStaffA);
        var staffBAssignment = dailyStaffA.StaffAssignments.FirstOrDefault(s => s.StaffId == staffB.Id);
        Assert.NotNull(staffBAssignment);
        Assert.Equal(swapDto.SwapId, staffBAssignment.SwapId);
        Assert.Equal(staffA.Id, staffBAssignment.SwappedWithStaffId);
        Assert.Equal("Aadhaar Test Staff A", staffBAssignment.SwappedWithStaffName);
        Assert.Equal("ST10001", staffBAssignment.SwappedWithStaffMasterId);
        Assert.Equal(showroomB.Id, staffBAssignment.OriginalShowroomId);
        Assert.Equal("Honda Central", staffBAssignment.OriginalShowroomName);
        Assert.Equal("HO10001", staffBAssignment.OriginalShowroomMasterId);

        // 3. Verify Showroom B daily staff shows Staff A (now working at Showroom B)
        var dailyStaffB = await service.GetDailyStaffAsync(showroomB.Id, date);
        Assert.NotNull(dailyStaffB);
        var staffAAssignment = dailyStaffB.StaffAssignments.FirstOrDefault(s => s.StaffId == staffA.Id);
        Assert.NotNull(staffAAssignment);
        Assert.Equal(swapDto.SwapId, staffAAssignment.SwapId); // Same Swap ID on both sides!
        Assert.Equal(staffB.Id, staffAAssignment.SwappedWithStaffId);
        Assert.Equal("Aadhaar Test Staff B", staffAAssignment.SwappedWithStaffName);
        Assert.Equal("ST10002", staffAAssignment.SwappedWithStaffMasterId);
        Assert.Equal(showroomA.Id, staffAAssignment.OriginalShowroomId);
        Assert.Equal("Maruti Nexa", staffAAssignment.OriginalShowroomName);
        Assert.Equal("MA10001", staffAAssignment.OriginalShowroomMasterId);

        // 4. Verify Audit Log
        Assert.Contains(audit.RecordedLogs, log =>
            log.action == AuditActions.StaffSwap &&
            log.module == AuditModules.Showrooms &&
            log.entityReference == swapDto.SwapId);
    }

    [Fact]
    public async Task SwapStaffAsync_SelfSwap_ThrowsValidationException()
    {
        var (db, service, _) = CreateTestContext();
        var (showroomA, showroomB, staffA, _) = await SeedShowroomsAndStaffAsync(db);

        var request = new CreateStaffSwapRequest
        {
            Date = DateTime.UtcNow.Date,
            StaffAId = staffA.Id,
            ShowroomAId = showroomA.Id,
            StaffBId = staffA.Id, // Same staff member
            ShowroomBId = showroomB.Id
        };

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            service.SwapStaffAsync(request, Guid.NewGuid(), isOwner: true));

        Assert.Contains("Cannot swap a staff member with themselves", ex.Message);
    }

    [Fact]
    public async Task SwapStaffAsync_LockedAttendance_ThrowsForNonOwner_AllowsForOwner()
    {
        var (db, service, _) = CreateTestContext();
        var (showroomA, showroomB, staffA, staffB) = await SeedShowroomsAndStaffAsync(db);
        var date = new DateTime(2026, 9, 27, 0, 0, 0, DateTimeKind.Utc);

        // Lock attendance on Showroom A
        db.ShowroomDailyAttendances.Add(new ShowroomDailyAttendance
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroomA.Id,
            Date = date,
            IsAttendanceConfirmed = true,
            AttendanceConfirmedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var request = new CreateStaffSwapRequest
        {
            Date = date,
            StaffAId = staffA.Id,
            ShowroomAId = showroomA.Id,
            StaffBId = staffB.Id,
            ShowroomBId = showroomB.Id
        };

        // Both Non-owner and Owner should fail while locked
        var exNonOwner = await Assert.ThrowsAsync<ValidationException>(() =>
            service.SwapStaffAsync(request, Guid.NewGuid(), isOwner: false));
        Assert.Contains("Attendance is confirmed for this date", exNonOwner.Message);

        var exOwner = await Assert.ThrowsAsync<ValidationException>(() =>
            service.SwapStaffAsync(request, Guid.NewGuid(), isOwner: true));
        Assert.Contains("Attendance is confirmed for this date", exOwner.Message);

        // After Owner unlocks attendance for correction, swap succeeds
        await service.UnlockAttendanceAsync(showroomA.Id, date, Guid.NewGuid(), isOwner: true);
        var result = await service.SwapStaffAsync(request, Guid.NewGuid(), isOwner: true);
        Assert.NotNull(result);
        Assert.StartsWith("SWP-20260927-", result.SwapId);
    }

    [Fact]
    public async Task GetSwapHistoryAsync_PreservesMultipleSwaps_AcrossDates()
    {
        var (db, service, _) = CreateTestContext();
        var (showroomA, showroomB, staffA, staffB) = await SeedShowroomsAndStaffAsync(db);

        var staffC = new Staff
        {
            Id = Guid.NewGuid(),
            Name = "Aadhaar Test Staff C",
            StaffMasterId = "ST10003",
            PhoneNumber = "9876543212",
            Role = "Detailer",
            IsActive = true,
            DefaultShowroomId = showroomB.Id
        };
        db.Staff.Add(staffC);
        await db.SaveChangesAsync();

        var date1 = new DateTime(2026, 9, 27, 0, 0, 0, DateTimeKind.Utc);
        var date2 = new DateTime(2026, 9, 28, 0, 0, 0, DateTimeKind.Utc);

        // Swap 1 on 27 Sep: Staff A <-> Staff B
        var swap1 = await service.SwapStaffAsync(new CreateStaffSwapRequest
        {
            Date = date1,
            StaffAId = staffA.Id,
            ShowroomAId = showroomA.Id,
            StaffBId = staffB.Id,
            ShowroomBId = showroomB.Id
        }, Guid.NewGuid(), isOwner: true);

        // Swap 2 on 28 Sep: Staff A <-> Staff C
        var swap2 = await service.SwapStaffAsync(new CreateStaffSwapRequest
        {
            Date = date2,
            StaffAId = staffA.Id,
            ShowroomAId = showroomA.Id,
            StaffBId = staffC.Id,
            ShowroomBId = showroomB.Id
        }, Guid.NewGuid(), isOwner: true);

        Assert.NotEqual(swap1.SwapId, swap2.SwapId);

        // Retrieve Swap History for Staff A
        var staffAHistory = await service.GetSwapHistoryAsync(staffId: staffA.Id);
        Assert.Equal(2, staffAHistory.Count);
        Assert.Contains(staffAHistory, s => s.SwapId == swap1.SwapId);
        Assert.Contains(staffAHistory, s => s.SwapId == swap2.SwapId);

        // Retrieve Swap History for Showroom A
        var showroomAHistory = await service.GetSwapHistoryAsync(showroomId: showroomA.Id);
        Assert.Equal(2, showroomAHistory.Count);
    }

    [Fact]
    public async Task ReverseSwapAsync_RestoresOriginalShowrooms_And_MarksSwapReversed()
    {
        var (db, service, audit) = CreateTestContext();
        var (showroomA, showroomB, staffA, staffB) = await SeedShowroomsAndStaffAsync(db);
        var date = new DateTime(2026, 9, 27, 0, 0, 0, DateTimeKind.Utc);

        var swap = await service.SwapStaffAsync(new CreateStaffSwapRequest
        {
            Date = date,
            StaffAId = staffA.Id,
            ShowroomAId = showroomA.Id,
            StaffBId = staffB.Id,
            ShowroomBId = showroomB.Id
        }, Guid.NewGuid(), isOwner: true);

        // Now reverse the swap
        var reversed = await service.ReverseSwapAsync(swap.SwapId, new ReverseStaffSwapRequest
        {
            Reason = "Shift schedule changed back"
        }, Guid.NewGuid(), isOwner: true);

        Assert.Equal("Reversed", reversed.Status);

        // Verify Staff A is back at Showroom A
        var dailyStaffA = await service.GetDailyStaffAsync(showroomA.Id, date);
        Assert.NotNull(dailyStaffA);
        Assert.Contains(dailyStaffA.StaffAssignments, s => s.StaffId == staffA.Id);

        // Verify Staff B is back at Showroom B
        var dailyStaffB = await service.GetDailyStaffAsync(showroomB.Id, date);
        Assert.NotNull(dailyStaffB);
        Assert.Contains(dailyStaffB.StaffAssignments, s => s.StaffId == staffB.Id);

        // Verify Reversal Audit Log
        Assert.Contains(audit.RecordedLogs, log =>
            log.action == AuditActions.StaffSwapReversed &&
            log.entityReference == swap.SwapId);
    }

    [Fact]
    public async Task SwapStaffAsync_WhenShowroomAAttendanceConfirmed_ThrowsValidationException()
    {
        var (db, service, _) = CreateTestContext();
        var (showroomA, showroomB, staffA, staffB) = await SeedShowroomsAndStaffAsync(db);
        var date = new DateTime(2026, 9, 27, 0, 0, 0, DateTimeKind.Utc);

        // Confirm attendance for Showroom A
        db.ShowroomDailyAttendances.Add(new ShowroomDailyAttendance
        {
            ShowroomId = showroomA.Id,
            Date = date,
            IsAttendanceConfirmed = true,
            AttendanceConfirmedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            service.SwapStaffAsync(new CreateStaffSwapRequest
            {
                Date = date,
                StaffAId = staffA.Id,
                ShowroomAId = showroomA.Id,
                StaffBId = staffB.Id,
                ShowroomBId = showroomB.Id
            }, Guid.NewGuid(), isOwner: true));

        Assert.Contains("Attendance is confirmed for this date", ex.Message);
    }

    [Fact]
    public async Task SwapStaffAsync_WhenShowroomBAttendanceConfirmed_ThrowsValidationException()
    {
        var (db, service, _) = CreateTestContext();
        var (showroomA, showroomB, staffA, staffB) = await SeedShowroomsAndStaffAsync(db);
        var date = new DateTime(2026, 9, 27, 0, 0, 0, DateTimeKind.Utc);

        // Confirm attendance for Showroom B
        db.ShowroomDailyAttendances.Add(new ShowroomDailyAttendance
        {
            ShowroomId = showroomB.Id,
            Date = date,
            IsAttendanceConfirmed = true,
            AttendanceConfirmedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            service.SwapStaffAsync(new CreateStaffSwapRequest
            {
                Date = date,
                StaffAId = staffA.Id,
                ShowroomAId = showroomA.Id,
                StaffBId = staffB.Id,
                ShowroomBId = showroomB.Id
            }, Guid.NewGuid(), isOwner: true));

        Assert.Contains("Attendance is confirmed for this date", ex.Message);
    }

    [Fact]
    public async Task ReverseSwapAsync_WhenShowroomAAttendanceConfirmed_ThrowsValidationException()
    {
        var (db, service, _) = CreateTestContext();
        var (showroomA, showroomB, staffA, staffB) = await SeedShowroomsAndStaffAsync(db);
        var date = new DateTime(2026, 9, 27, 0, 0, 0, DateTimeKind.Utc);

        var swap = await service.SwapStaffAsync(new CreateStaffSwapRequest
        {
            Date = date,
            StaffAId = staffA.Id,
            ShowroomAId = showroomA.Id,
            StaffBId = staffB.Id,
            ShowroomBId = showroomB.Id
        }, Guid.NewGuid(), isOwner: true);

        // Confirm attendance for Showroom A
        db.ShowroomDailyAttendances.Add(new ShowroomDailyAttendance
        {
            ShowroomId = showroomA.Id,
            Date = date,
            IsAttendanceConfirmed = true,
            AttendanceConfirmedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            service.ReverseSwapAsync(swap.SwapId, new ReverseStaffSwapRequest
            {
                Reason = "Attempted reversal after confirmation"
            }, Guid.NewGuid(), isOwner: true));

        Assert.Contains("Attendance is confirmed for this date", ex.Message);
    }

    [Fact]
    public async Task ReverseSwapAsync_WhenShowroomBAttendanceConfirmed_ThrowsValidationException()
    {
        var (db, service, _) = CreateTestContext();
        var (showroomA, showroomB, staffA, staffB) = await SeedShowroomsAndStaffAsync(db);
        var date = new DateTime(2026, 9, 27, 0, 0, 0, DateTimeKind.Utc);

        var swap = await service.SwapStaffAsync(new CreateStaffSwapRequest
        {
            Date = date,
            StaffAId = staffA.Id,
            ShowroomAId = showroomA.Id,
            StaffBId = staffB.Id,
            ShowroomBId = showroomB.Id
        }, Guid.NewGuid(), isOwner: true);

        // Confirm attendance for Showroom B
        db.ShowroomDailyAttendances.Add(new ShowroomDailyAttendance
        {
            ShowroomId = showroomB.Id,
            Date = date,
            IsAttendanceConfirmed = true,
            AttendanceConfirmedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            service.ReverseSwapAsync(swap.SwapId, new ReverseStaffSwapRequest
            {
                Reason = "Attempted reversal after confirmation"
            }, Guid.NewGuid(), isOwner: true));

        Assert.Contains("Attendance is confirmed for this date", ex.Message);
    }

    [Fact]
    public async Task ReverseSwapAsync_WhenAlreadyReversed_ThrowsValidationException()
    {
        var (db, service, _) = CreateTestContext();
        var (showroomA, showroomB, staffA, staffB) = await SeedShowroomsAndStaffAsync(db);
        var date = new DateTime(2026, 9, 27, 0, 0, 0, DateTimeKind.Utc);

        var swap = await service.SwapStaffAsync(new CreateStaffSwapRequest
        {
            Date = date,
            StaffAId = staffA.Id,
            ShowroomAId = showroomA.Id,
            StaffBId = staffB.Id,
            ShowroomBId = showroomB.Id
        }, Guid.NewGuid(), isOwner: true);

        // 1st Reversal succeeds
        await service.ReverseSwapAsync(swap.SwapId, new ReverseStaffSwapRequest
        {
            Reason = "First reversal"
        }, Guid.NewGuid(), isOwner: true);

        // 2nd Reversal fails
        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            service.ReverseSwapAsync(swap.SwapId, new ReverseStaffSwapRequest
            {
                Reason = "Second reversal attempt"
            }, Guid.NewGuid(), isOwner: true));

        Assert.Contains("already been reversed", ex.Message);
    }

    [Fact]
    public async Task UnlockForCorrection_AllowsReversal_And_ReconfirmBlocksAgain()
    {
        var (db, service, audit) = CreateTestContext();
        var (showroomA, showroomB, staffA, staffB) = await SeedShowroomsAndStaffAsync(db);
        var date = new DateTime(2026, 9, 27, 0, 0, 0, DateTimeKind.Utc);
        var ownerId = Guid.NewGuid();

        // 1. Create Swap
        var swap = await service.SwapStaffAsync(new CreateStaffSwapRequest
        {
            Date = date,
            StaffAId = staffA.Id,
            ShowroomAId = showroomA.Id,
            StaffBId = staffB.Id,
            ShowroomBId = showroomB.Id
        }, ownerId, isOwner: true);

        // 2. Confirm Attendance for Showroom A
        await service.ConfirmAttendanceAsync(showroomA.Id, date, ownerId);

        // 3. Attempt reversal -> Must fail with ValidationException
        await Assert.ThrowsAsync<ValidationException>(() =>
            service.ReverseSwapAsync(swap.SwapId, new ReverseStaffSwapRequest { Reason = "Attempt 1" }, ownerId, isOwner: true));

        // 4. Owner unlocks attendance for correction
        var unlocked = await service.UnlockAttendanceAsync(showroomA.Id, date, ownerId, isOwner: true);
        Assert.False(unlocked.IsAttendanceConfirmed);

        // 5. Reversal now succeeds during correction
        var reversed = await service.ReverseSwapAsync(swap.SwapId, new ReverseStaffSwapRequest { Reason = "Correction reversal" }, ownerId, isOwner: true);
        Assert.Equal("Reversed", reversed.Status);

        // 6. Owner re-confirms attendance
        var reconfirmed = await service.ConfirmAttendanceAsync(showroomA.Id, date, ownerId);
        Assert.True(reconfirmed.IsAttendanceConfirmed);

        // 7. Further swap attempts are locked again
        await Assert.ThrowsAsync<ValidationException>(() =>
            service.SwapStaffAsync(new CreateStaffSwapRequest
            {
                Date = date,
                StaffAId = staffA.Id,
                ShowroomAId = showroomA.Id,
                StaffBId = staffB.Id,
                ShowroomBId = showroomB.Id
            }, ownerId, isOwner: true));
    }

    [Fact]
    public async Task SwapStaffAsync_WithCoveragePeriod_CalculatesDuration_And_PersistsTimesCorrectly()
    {
        var (db, service, audit) = CreateTestContext();
        var (showroomA, showroomB, staffA, staffB) = await SeedShowroomsAndStaffAsync(db);
        var date = new DateTime(2026, 9, 27, 0, 0, 0, DateTimeKind.Utc);
        var ownerId = Guid.NewGuid();

        // Swap with 14:00 to 18:00 coverage period
        var swap = await service.SwapStaffAsync(new CreateStaffSwapRequest
        {
            Date = date,
            StaffAId = staffA.Id,
            ShowroomAId = showroomA.Id,
            StaffBId = staffB.Id,
            ShowroomBId = showroomB.Id,
            CoverageStartTime = "14:00",
            CoverageEndTime = "18:00",
            Reason = "Afternoon detailing coverage"
        }, ownerId, isOwner: true);

        Assert.Equal("14:00", swap.CoverageStartTime);
        Assert.Equal("18:00", swap.CoverageEndTime);
        Assert.Equal(4.0, swap.CoverageDurationHours);
        Assert.Equal("4 hours", swap.CoverageDurationFormatted);

        // Verify database persistence
        var entity = await db.ShowroomStaffSwaps.FirstOrDefaultAsync(s => s.SwapId == swap.SwapId);
        Assert.NotNull(entity);
        Assert.Equal("14:00", entity.CoverageStartTime);
        Assert.Equal("18:00", entity.CoverageEndTime);
        Assert.Equal(4.00m, entity.CoverageDurationHours);

        // Verify GetSwapById
        var fetched = await service.GetSwapByIdAsync(swap.SwapId);
        Assert.NotNull(fetched);
        Assert.Equal("14:00", fetched.CoverageStartTime);
        Assert.Equal("18:00", fetched.CoverageEndTime);
        Assert.Equal(4.0, fetched.CoverageDurationHours);
        Assert.Equal("4 hours", fetched.CoverageDurationFormatted);

        // Verify Swap History
        var history = await service.GetSwapHistoryAsync(showroomId: showroomA.Id, date: date);
        var item = Assert.Single(history);
        Assert.Equal("14:00", item.CoverageStartTime);
        Assert.Equal("18:00", item.CoverageEndTime);
        Assert.Equal(4.0, item.CoverageDurationHours);
        Assert.Equal("4 hours", item.CoverageDurationFormatted);
    }

    [Fact]
    public async Task SwapStaffAsync_WithFractionalCoveragePeriod_CalculatesDurationCorrectly()
    {
        var (db, service, audit) = CreateTestContext();
        var (showroomA, showroomB, staffA, staffB) = await SeedShowroomsAndStaffAsync(db);
        var date = new DateTime(2026, 9, 27, 0, 0, 0, DateTimeKind.Utc);
        var ownerId = Guid.NewGuid();

        // 10:00 to 15:30 -> 5.5 hours
        var swap = await service.SwapStaffAsync(new CreateStaffSwapRequest
        {
            Date = date,
            StaffAId = staffA.Id,
            ShowroomAId = showroomA.Id,
            StaffBId = staffB.Id,
            ShowroomBId = showroomB.Id,
            CoverageStartTime = "10:00",
            CoverageEndTime = "15:30",
            Reason = "Partial shift ceramic coating"
        }, ownerId, isOwner: true);

        Assert.Equal("10:00", swap.CoverageStartTime);
        Assert.Equal("15:30", swap.CoverageEndTime);
        Assert.Equal(5.5, swap.CoverageDurationHours);
        Assert.Equal("5.5 hours", swap.CoverageDurationFormatted);
    }

    [Fact]
    public async Task SwapStaffAsync_WithInvalidTimePeriod_ThrowsValidationException()
    {
        var (db, service, audit) = CreateTestContext();
        var (showroomA, showroomB, staffA, staffB) = await SeedShowroomsAndStaffAsync(db);
        var date = new DateTime(2026, 9, 27, 0, 0, 0, DateTimeKind.Utc);
        var ownerId = Guid.NewGuid();

        // End time before start time: 18:00 to 14:00
        var ex1 = await Assert.ThrowsAsync<ValidationException>(() =>
            service.SwapStaffAsync(new CreateStaffSwapRequest
            {
                Date = date,
                StaffAId = staffA.Id,
                ShowroomAId = showroomA.Id,
                StaffBId = staffB.Id,
                ShowroomBId = showroomB.Id,
                CoverageStartTime = "18:00",
                CoverageEndTime = "14:00"
            }, ownerId, isOwner: true));

        Assert.Contains("later than Coverage Start Time", ex1.Message);

        // Same start and end time: 14:00 to 14:00
        var ex2 = await Assert.ThrowsAsync<ValidationException>(() =>
            service.SwapStaffAsync(new CreateStaffSwapRequest
            {
                Date = date,
                StaffAId = staffA.Id,
                ShowroomAId = showroomA.Id,
                StaffBId = staffB.Id,
                ShowroomBId = showroomB.Id,
                CoverageStartTime = "14:00",
                CoverageEndTime = "14:00"
            }, ownerId, isOwner: true));

        Assert.Contains("later than Coverage Start Time", ex2.Message);
    }

    [Fact]
    public async Task ReverseSwapAsync_PreservesCoveragePeriodAndFormattedDuration()
    {
        var (db, service, audit) = CreateTestContext();
        var (showroomA, showroomB, staffA, staffB) = await SeedShowroomsAndStaffAsync(db);
        var date = new DateTime(2026, 9, 27, 0, 0, 0, DateTimeKind.Utc);
        var ownerId = Guid.NewGuid();

        var swap = await service.SwapStaffAsync(new CreateStaffSwapRequest
        {
            Date = date,
            StaffAId = staffA.Id,
            ShowroomAId = showroomA.Id,
            StaffBId = staffB.Id,
            ShowroomBId = showroomB.Id,
            CoverageStartTime = "14:00",
            CoverageEndTime = "18:00",
            Reason = "Afternoon coverage"
        }, ownerId, isOwner: true);

        var reversed = await service.ReverseSwapAsync(swap.SwapId, new ReverseStaffSwapRequest
        {
            Reason = "Schedule cancelled"
        }, ownerId, isOwner: true);

        Assert.Equal("Reversed", reversed.Status);
        Assert.Equal("14:00", reversed.CoverageStartTime);
        Assert.Equal("18:00", reversed.CoverageEndTime);
        Assert.Equal(4.0, reversed.CoverageDurationHours);
        Assert.Equal("4 hours", reversed.CoverageDurationFormatted);

        // History reflects reversed swap with coverage period intact
        var history = await service.GetSwapHistoryAsync(showroomId: showroomA.Id, date: date);
        var item = Assert.Single(history);
        Assert.Equal("Reversed", item.Status);
        Assert.Equal("14:00", item.CoverageStartTime);
        Assert.Equal("18:00", item.CoverageEndTime);
        Assert.Equal(4.0, item.CoverageDurationHours);
        Assert.Equal("4 hours", item.CoverageDurationFormatted);
    }
}
