using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.StaffSalary;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class StaffSalarySettlementTests
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

    private static (AppDbContext db, StaffSalaryService service, TestAuditLogService audit) CreateTestContext()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName)
                   .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

        var audit = new TestAuditLogService();
        services.AddSingleton<IAuditLogService>(audit);
        services.AddScoped<StaffSalaryService>();

        var provider = services.BuildServiceProvider();
        var db = provider.GetRequiredService<AppDbContext>();
        var service = provider.GetRequiredService<StaffSalaryService>();

        return (db, service, audit);
    }

    private static Staff CreateStaff(AppDbContext db, string name = "Ramesh Kumar")
    {
        var staff = new Staff
        {
            Id = Guid.NewGuid(),
            Name = name,
            PhoneNumber = "9876543210",
            Role = "Senior Specialist",
            IsActive = true
        };
        db.Staff.Add(staff);
        db.SaveChanges();
        return staff;
    }

    [Fact]
    public async Task SaveEnteredSalary_ThrowsValidationException_WhenNegativeSalary()
    {
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);

        var request = new SaveEnteredSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-30",
            EnteredSalary = -500m
        };

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            service.SaveEnteredSalaryAsync(request, Guid.NewGuid()));

        Assert.Contains("negative", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SaveEnteredSalary_ThrowsValidationException_WhenPeriodFromLaterThanPeriodTo()
    {
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);

        var request = new SaveEnteredSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-30",
            PeriodTo = "2026-09-01",
            EnteredSalary = 20000m
        };

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            service.SaveEnteredSalaryAsync(request, Guid.NewGuid()));

        Assert.Contains("To Date cannot be earlier than From Date", ex.Message);
    }

    [Fact]
    public async Task SaveEnteredSalary_SupportsZeroSalary()
    {
        var (db, service, audit) = CreateTestContext();
        var staff = CreateStaff(db);

        var request = new SaveEnteredSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-30",
            EnteredSalary = 0m
        };

        var result = await service.SaveEnteredSalaryAsync(request, Guid.NewGuid());

        Assert.Equal(0m, result.EnteredSalary);
        Assert.Equal("Ready", result.Status);
        Assert.Contains(audit.RecordedActions, a => a.action == "staff_salary.entered");
    }

    [Fact]
    public async Task SettleSalary_WithNoAdvance_FinalSalaryEqualsEnteredSalary()
    {
        var (db, service, audit) = CreateTestContext();
        var staff = CreateStaff(db);
        var userId = Guid.NewGuid();

        var request = new SettleStaffSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-30",
            EnteredSalary = 25000m
        };

        var settlement = await service.SettleSalaryAsync(request, userId);

        Assert.Equal(25000m, settlement.EnteredSalary);
        Assert.Equal(0m, settlement.OutstandingAdvanceBeforeSettlement);
        Assert.Equal(0m, settlement.AdvanceDeduction);
        Assert.Equal(25000m, settlement.FinalSalary);
        Assert.Equal(0m, settlement.RemainingAdvanceAfterSettlement);
        Assert.Equal("Settled", settlement.Status);

        Assert.Contains(audit.RecordedActions, a => a.action == "staff_salary.settled");
    }

    [Fact]
    public async Task SettleSalary_WhenSalaryLessThanAdvance_CapsDeductionAndPreservesRemaining()
    {
        // Example from prompt:
        // Entered Salary = 10,000, Outstanding Advance = 15,308
        // Advance Deduction = 10,000, Final Salary = 0, Remaining Advance = 5,308
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);
        var userId = Guid.NewGuid();

        db.StaffAdvances.Add(new StaffAdvance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            Amount = 15308m,
            BalanceAmount = 15308m,
            AdvanceDate = new DateTime(2026, 9, 5, 0, 0, 0, DateTimeKind.Utc),
            Status = StaffAdvanceStatus.Outstanding,
            Reason = "Medical Help",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var request = new SettleStaffSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-30",
            EnteredSalary = 10000m
        };

        var settlement = await service.SettleSalaryAsync(request, userId);

        Assert.Equal(10000m, settlement.EnteredSalary);
        Assert.Equal(15308m, settlement.OutstandingAdvanceBeforeSettlement);
        Assert.Equal(10000m, settlement.AdvanceDeduction);
        Assert.Equal(0m, settlement.FinalSalary);
        Assert.Equal(5308m, settlement.RemainingAdvanceAfterSettlement);
        Assert.Equal("Settled", settlement.Status);

        // Advance must remain Outstanding with BalanceAmount = 5,308
        var advance = await db.StaffAdvances.FirstAsync(a => a.StaffId == staff.Id);
        Assert.Equal(StaffAdvanceStatus.Outstanding, advance.Status);
        Assert.Equal(5308m, advance.BalanceAmount);
        Assert.Equal(15308m, advance.Amount); // Original amount preserved
    }

    [Fact]
    public async Task SettleSalary_WhenSalaryGreaterThanAdvance_FullyDeductsAdvanceAndCalculatesFinalSalary()
    {
        // Example from prompt:
        // Entered Salary = 20,000, Outstanding Advance = 15,308
        // Advance Deduction = 15,308, Final Salary = 4,692, Remaining Advance = 0
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);
        var userId = Guid.NewGuid();

        db.StaffAdvances.Add(new StaffAdvance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            Amount = 15308m,
            BalanceAmount = 15308m,
            AdvanceDate = new DateTime(2026, 9, 5, 0, 0, 0, DateTimeKind.Utc),
            Status = StaffAdvanceStatus.Outstanding,
            Reason = "Festival Advance",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var request = new SettleStaffSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-30",
            EnteredSalary = 20000m
        };

        var settlement = await service.SettleSalaryAsync(request, userId);

        Assert.Equal(20000m, settlement.EnteredSalary);
        Assert.Equal(15308m, settlement.OutstandingAdvanceBeforeSettlement);
        Assert.Equal(15308m, settlement.AdvanceDeduction);
        Assert.Equal(4692m, settlement.FinalSalary);
        Assert.Equal(0m, settlement.RemainingAdvanceAfterSettlement);

        // Advance must be marked Settled with BalanceAmount = 0
        var advance = await db.StaffAdvances.FirstAsync(a => a.StaffId == staff.Id);
        Assert.Equal(StaffAdvanceStatus.Settled, advance.Status);
        Assert.Equal(0m, advance.BalanceAmount);
        Assert.NotNull(advance.SettledAt);
        Assert.Equal(userId, advance.SettledByUserId);
        Assert.Equal(settlement.Id, advance.StaffSalarySettlementId);
    }

    [Fact]
    public async Task SettleSalary_FifoRecovery_RecoversOldestAdvancesFirstAndPreservesPartialBalance()
    {
        // Prompt Section 7 FIFO example:
        // Advance A = ₹6,543 (oldest)
        // Advance B = ₹8,765 (middle)
        // Advance C = ₹2,000 (newest)
        // Total Outstanding = 17,308
        // Entered Salary = ₹10,000
        // Expected:
        // Advance A: fully recovered (Balance = 0, Settled)
        // Advance B: ₹3,457 recovered (Balance = 5,308, Outstanding)
        // Advance C: ₹0 recovered (Balance = 2,000, Outstanding)
        // Advance Deduction = 10,000, Final Salary = 0, Remaining Advance = 7,308
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);
        var userId = Guid.NewGuid();

        var advA = new StaffAdvance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            Amount = 6543m,
            BalanceAmount = 6543m,
            AdvanceDate = new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc),
            Status = StaffAdvanceStatus.Outstanding,
            Reason = "Advance A",
            CreatedAt = new DateTime(2026, 8, 1, 10, 0, 0, DateTimeKind.Utc)
        };

        var advB = new StaffAdvance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            Amount = 8765m,
            BalanceAmount = 8765m,
            AdvanceDate = new DateTime(2026, 8, 15, 0, 0, 0, DateTimeKind.Utc),
            Status = StaffAdvanceStatus.Outstanding,
            Reason = "Advance B",
            CreatedAt = new DateTime(2026, 8, 15, 10, 0, 0, DateTimeKind.Utc)
        };

        var advC = new StaffAdvance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            Amount = 2000m,
            BalanceAmount = 2000m,
            AdvanceDate = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
            Status = StaffAdvanceStatus.Outstanding,
            Reason = "Advance C",
            CreatedAt = new DateTime(2026, 9, 1, 10, 0, 0, DateTimeKind.Utc)
        };

        db.StaffAdvances.AddRange(advA, advB, advC);
        await db.SaveChangesAsync();

        var request = new SettleStaffSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-30",
            EnteredSalary = 10000m
        };

        var settlement = await service.SettleSalaryAsync(request, userId);

        Assert.Equal(10000m, settlement.EnteredSalary);
        Assert.Equal(17308m, settlement.OutstandingAdvanceBeforeSettlement);
        Assert.Equal(10000m, settlement.AdvanceDeduction);
        Assert.Equal(0m, settlement.FinalSalary);
        Assert.Equal(7308m, settlement.RemainingAdvanceAfterSettlement);

        // Verify Advance A
        var updatedA = await db.StaffAdvances.FindAsync(advA.Id);
        Assert.Equal(StaffAdvanceStatus.Settled, updatedA!.Status);
        Assert.Equal(0m, updatedA.BalanceAmount);
        Assert.Equal(6543m, updatedA.Amount);

        // Verify Advance B
        var updatedB = await db.StaffAdvances.FindAsync(advB.Id);
        Assert.Equal(StaffAdvanceStatus.Outstanding, updatedB!.Status);
        Assert.Equal(5308m, updatedB.BalanceAmount);
        Assert.Equal(8765m, updatedB.Amount);

        // Verify Advance C
        var updatedC = await db.StaffAdvances.FindAsync(advC.Id);
        Assert.Equal(StaffAdvanceStatus.Outstanding, updatedC!.Status);
        Assert.Equal(2000m, updatedC.BalanceAmount);
        Assert.Equal(2000m, updatedC.Amount);
    }

    [Fact]
    public async Task SettleSalary_ThrowsConflictException_WhenAlreadySettledForExactPeriod()
    {
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);
        var userId = Guid.NewGuid();

        var request = new SettleStaffSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-30",
            EnteredSalary = 20000m
        };

        // First settlement succeeds
        await service.SettleSalaryAsync(request, userId);

        // Second settlement attempt for the exact same staff + period must be rejected
        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            service.SettleSalaryAsync(request, userId));

        Assert.Contains("already been settled", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SaveEnteredSalary_ThrowsConflictException_WhenAlreadySettled()
    {
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);
        var userId = Guid.NewGuid();

        var settleRequest = new SettleStaffSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-30",
            EnteredSalary = 20000m
        };

        await service.SettleSalaryAsync(settleRequest, userId);

        // Attempting to edit salary after settlement must fail
        var editRequest = new SaveEnteredSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-30",
            EnteredSalary = 25000m
        };

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            service.SaveEnteredSalaryAsync(editRequest, userId));

        Assert.Contains("cannot be edited", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AttendanceDoesNotAffectSalaryCalculation()
    {
        // Prompt Section 21 explicit test requirement:
        // Attendance records: Present = 10, HalfDay = 5, Leave = 3, Unmarked = 2
        // Entered Salary = ₹20,000, Advance = ₹5,000
        // Expected: Advance Deduction = ₹5,000, Final Salary = ₹15,000
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);
        var userId = Guid.NewGuid();

        // Seed diverse attendance records
        for (int d = 1; d <= 10; d++)
        {
            db.StaffAttendances.Add(new StaffAttendance
            {
                Id = Guid.NewGuid(),
                StaffId = staff.Id,
                AttendanceDate = new DateTime(2026, 9, d, 0, 0, 0, DateTimeKind.Utc),
                Status = StaffAttendanceStatus.Present
            });
        }
        for (int d = 11; d <= 15; d++)
        {
            db.StaffAttendances.Add(new StaffAttendance
            {
                Id = Guid.NewGuid(),
                StaffId = staff.Id,
                AttendanceDate = new DateTime(2026, 9, d, 0, 0, 0, DateTimeKind.Utc),
                Status = StaffAttendanceStatus.HalfDay
            });
        }
        for (int d = 16; d <= 18; d++)
        {
            db.StaffAttendances.Add(new StaffAttendance
            {
                Id = Guid.NewGuid(),
                StaffId = staff.Id,
                AttendanceDate = new DateTime(2026, 9, d, 0, 0, 0, DateTimeKind.Utc),
                Status = StaffAttendanceStatus.Leave
            });
        }

        // Advance of ₹5,000
        db.StaffAdvances.Add(new StaffAdvance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            Amount = 5000m,
            BalanceAmount = 5000m,
            AdvanceDate = new DateTime(2026, 9, 2, 0, 0, 0, DateTimeKind.Utc),
            Status = StaffAdvanceStatus.Outstanding,
            Reason = "Advance"
        });

        await db.SaveChangesAsync();

        var request = new SettleStaffSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-20",
            EnteredSalary = 20000m
        };

        var settlement = await service.SettleSalaryAsync(request, userId);

        // Verification: Zero attendance deduction!
        Assert.Equal(20000m, settlement.EnteredSalary);
        Assert.Equal(5000m, settlement.AdvanceDeduction);
        Assert.Equal(15000m, settlement.FinalSalary);
        Assert.Equal(0m, settlement.RemainingAdvanceAfterSettlement);
    }

    [Fact]
    public async Task HistoricalSettlementSnapshot_RemainsUnchangedAfterLaterAdvanceActivity()
    {
        // Prompt Section 5 & 22:
        // Settled salary record must preserve its snapshot even if new advances are taken later
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);
        var userId = Guid.NewGuid();

        // Initial advance of ₹15,308
        db.StaffAdvances.Add(new StaffAdvance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            Amount = 15308m,
            BalanceAmount = 15308m,
            AdvanceDate = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
            Status = StaffAdvanceStatus.Outstanding,
            Reason = "Advance 1"
        });
        await db.SaveChangesAsync();

        // Settle salary for September
        var settleRequest = new SettleStaffSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-30",
            EnteredSalary = 20000m
        };
        await service.SettleSalaryAsync(settleRequest, userId);

        // Later in October, staff takes a NEW advance of ₹10,000
        db.StaffAdvances.Add(new StaffAdvance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            Amount = 10000m,
            BalanceAmount = 10000m,
            AdvanceDate = new DateTime(2026, 10, 5, 0, 0, 0, DateTimeKind.Utc),
            Status = StaffAdvanceStatus.Outstanding,
            Reason = "Advance October"
        });
        await db.SaveChangesAsync();

        // Query the roster for September (01-Sep to 30-Sep)
        var roster = await service.GetSalaryRosterAsync(
            new DateTime(2026, 9, 1),
            new DateTime(2026, 9, 30),
            staff.Id);

        var septemberRecord = Assert.Single(roster.Items);
        Assert.Equal("Settled", septemberRecord.Status);
        Assert.Equal(20000m, septemberRecord.EnteredSalary);
        Assert.Equal(15308m, septemberRecord.OutstandingAdvance); // Must be historical ₹15,308, NOT ₹10,000!
        Assert.Equal(15308m, septemberRecord.AdvanceDeduction);
        Assert.Equal(4692m, septemberRecord.FinalSalary);
        Assert.Equal(0m, septemberRecord.RemainingAdvance);
    }

    [Fact]
    public async Task ApplicableAdvance_ChangesAccordingToSalaryPeriod_ExcludesFutureAdvances()
    {
        // Staff has Advance A in August (₹5,000) and Advance B in September (₹7,000)
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);

        db.StaffAdvances.AddRange(
            new StaffAdvance
            {
                Id = Guid.NewGuid(),
                StaffId = staff.Id,
                Amount = 5000m,
                BalanceAmount = 5000m,
                AdvanceDate = new DateTime(2026, 8, 5, 0, 0, 0, DateTimeKind.Utc),
                Status = StaffAdvanceStatus.Outstanding,
                Reason = "Advance A (August)"
            },
            new StaffAdvance
            {
                Id = Guid.NewGuid(),
                StaffId = staff.Id,
                Amount = 7000m,
                BalanceAmount = 7000m,
                AdvanceDate = new DateTime(2026, 9, 15, 0, 0, 0, DateTimeKind.Utc),
                Status = StaffAdvanceStatus.Outstanding,
                Reason = "Advance B (September)"
            }
        );
        await db.SaveChangesAsync();

        // 1. August roster query (01-08-2026 to 31-08-2026) -> Only Advance A is applicable
        var augustRoster = await service.GetSalaryRosterAsync(
            new DateTime(2026, 8, 1),
            new DateTime(2026, 8, 31),
            staff.Id);

        var augustItem = Assert.Single(augustRoster.Items);
        Assert.Equal(5000m, augustItem.OutstandingAdvance);

        // 2. September roster query (01-09-2026 to 30-09-2026) -> Both Advance A and B are applicable
        var septemberRoster = await service.GetSalaryRosterAsync(
            new DateTime(2026, 9, 1),
            new DateTime(2026, 9, 30),
            staff.Id);

        var septemberItem = Assert.Single(septemberRoster.Items);
        Assert.Equal(12000m, septemberItem.OutstandingAdvance);
    }

    [Fact]
    public async Task SwitchingPeriod_LoadsExistingSavedSalaryForThatPeriod_AndDoesNotCopyBetweenPeriods()
    {
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);
        var userId = Guid.NewGuid();

        // Enter and save salary for September (₹20,000)
        await service.SaveEnteredSalaryAsync(new SaveEnteredSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-30",
            EnteredSalary = 20000m
        }, userId);

        // Enter and save salary for August (₹18,000)
        await service.SaveEnteredSalaryAsync(new SaveEnteredSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-08-01",
            PeriodTo = "2026-08-31",
            EnteredSalary = 18000m
        }, userId);

        // 1. Query August -> loads ₹18,000
        var augustRoster = await service.GetSalaryRosterAsync(
            new DateTime(2026, 8, 1),
            new DateTime(2026, 8, 31),
            staff.Id);
        var augustItem = Assert.Single(augustRoster.Items);
        Assert.Equal(18000m, augustItem.EnteredSalary);
        Assert.Equal("Ready", augustItem.Status);

        // 2. Switch: Query September -> loads ₹20,000
        var septRoster = await service.GetSalaryRosterAsync(
            new DateTime(2026, 9, 1),
            new DateTime(2026, 9, 30),
            staff.Id);
        var septItem = Assert.Single(septRoster.Items);
        Assert.Equal(20000m, septItem.EnteredSalary);
        Assert.Equal("Ready", septItem.Status);

        // 3. Query July (no saved salary) -> returns NotEntered, does NOT copy August or September
        var julyRoster = await service.GetSalaryRosterAsync(
            new DateTime(2026, 7, 1),
            new DateTime(2026, 7, 31),
            staff.Id);
        var julyItem = Assert.Single(julyRoster.Items);
        Assert.Null(julyItem.EnteredSalary);
        Assert.Equal("NotEntered", julyItem.Status);
    }

    [Fact]
    public async Task SettleSalary_OnlyRecoversAdvancesApplicableToPeriod_LeavesFutureAdvancesIntact()
    {
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);
        var userId = Guid.NewGuid();

        var advAug = new StaffAdvance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            Amount = 5000m,
            BalanceAmount = 5000m,
            AdvanceDate = new DateTime(2026, 8, 5, 0, 0, 0, DateTimeKind.Utc),
            Status = StaffAdvanceStatus.Outstanding,
            Reason = "August advance"
        };
        var advSept = new StaffAdvance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            Amount = 7000m,
            BalanceAmount = 7000m,
            AdvanceDate = new DateTime(2026, 9, 15, 0, 0, 0, DateTimeKind.Utc),
            Status = StaffAdvanceStatus.Outstanding,
            Reason = "September advance"
        };

        db.StaffAdvances.AddRange(advAug, advSept);
        await db.SaveChangesAsync();

        // Settle August with salary ₹10,000
        var settlement = await service.SettleSalaryAsync(new SettleStaffSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-08-01",
            PeriodTo = "2026-08-31",
            EnteredSalary = 10000m
        }, userId);

        // Settlement recovers only August advance (₹5,000)
        Assert.Equal(10000m, settlement.EnteredSalary);
        Assert.Equal(5000m, settlement.OutstandingAdvanceBeforeSettlement);
        Assert.Equal(5000m, settlement.AdvanceDeduction);
        Assert.Equal(5000m, settlement.FinalSalary);
        Assert.Equal(0m, settlement.RemainingAdvanceAfterSettlement);

        // August advance is Settled
        var updatedAug = await db.StaffAdvances.FindAsync(advAug.Id);
        Assert.Equal(StaffAdvanceStatus.Settled, updatedAug!.Status);
        Assert.Equal(0m, updatedAug.BalanceAmount);

        // September advance remains Outstanding with full ₹7,000 balance!
        var updatedSept = await db.StaffAdvances.FindAsync(advSept.Id);
        Assert.Equal(StaffAdvanceStatus.Outstanding, updatedSept!.Status);
        Assert.Equal(7000m, updatedSept.BalanceAmount);
    }

    [Fact]
    public async Task GetSalaryRoster_DoesNotMutateReadySalaryRecords_IsStrictlyReadOnly()
    {
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);
        var userId = Guid.NewGuid();

        // 1. Explicitly save Ready salary for September: 01 Sep -> 30 Sep, ₹20,000
        await service.SaveEnteredSalaryAsync(new SaveEnteredSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-30",
            EnteredSalary = 20000m
        }, userId);

        var readyRecord = await db.StaffSalarySettlements
            .FirstAsync(s => s.StaffId == staff.Id && s.Status == StaffSalaryStatus.Ready);
        Assert.Equal(new DateTime(2026, 9, 1), readyRecord.PeriodFrom);
        Assert.Equal(new DateTime(2026, 9, 30), readyRecord.PeriodTo);
        Assert.Equal(20000m, readyRecord.EnteredSalary);

        // 2. Query roster for a different period (e.g. 01 Sep -> 22 Sep)
        var roster = await service.GetSalaryRosterAsync(
            new DateTime(2026, 9, 1),
            new DateTime(2026, 9, 22),
            staff.Id);

        // 3. Database record MUST NOT be mutated by GET request!
        var afterGetRecord = await db.StaffSalarySettlements
            .FirstAsync(s => s.StaffId == staff.Id && s.Status == StaffSalaryStatus.Ready);
        Assert.Equal(new DateTime(2026, 9, 1), afterGetRecord.PeriodFrom);
        Assert.Equal(new DateTime(2026, 9, 30), afterGetRecord.PeriodTo);
        Assert.Equal(20000m, afterGetRecord.EnteredSalary);
        Assert.Equal(StaffSalaryStatus.Ready, afterGetRecord.Status);
    }

    [Fact]
    public async Task SaveEnteredSalary_ExplicitSave_PersistsReadyRecordWithExactDatesAndSalary()
    {
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);
        var userId = Guid.NewGuid();

        // Explicit Save for arbitrary period 01 Sep -> 22 Sep with ₹20,000
        var saved = await service.SaveEnteredSalaryAsync(new SaveEnteredSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-22",
            EnteredSalary = 20000m
        }, userId);

        Assert.Equal(20000m, saved.EnteredSalary);
        Assert.Equal("Ready", saved.Status);
        Assert.Equal("2026-09-01", saved.PeriodFrom);
        Assert.Equal("2026-09-22", saved.PeriodTo);

        var dbRecord = await db.StaffSalarySettlements.FirstAsync(s => s.StaffId == staff.Id);
        Assert.Equal(new DateTime(2026, 9, 1), dbRecord.PeriodFrom);
        Assert.Equal(new DateTime(2026, 9, 22), dbRecord.PeriodTo);
        Assert.Equal(20000m, dbRecord.EnteredSalary);
        Assert.Equal(StaffSalaryStatus.Ready, dbRecord.Status);
    }

    [Fact]
    public async Task SaveEnteredSalary_ExplicitEdit_UpdatesExistingReadyRecord()
    {
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);
        var userId = Guid.NewGuid();

        // 1. Initial explicit save: 01 Sep -> 30 Sep, ₹20,000
        await service.SaveEnteredSalaryAsync(new SaveEnteredSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-30",
            EnteredSalary = 20000m
        }, userId);

        // 2. User opens edit and explicitly updates to 01 Sep -> 22 Sep, ₹22,000
        await service.SaveEnteredSalaryAsync(new SaveEnteredSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-22",
            EnteredSalary = 22000m,
            Notes = "Updated period"
        }, userId);

        // 3. Database has single updated Ready record (no duplicate conflicting records)
        var count = await db.StaffSalarySettlements.CountAsync(s => s.StaffId == staff.Id);
        Assert.Equal(1, count);

        var updated = await db.StaffSalarySettlements.FirstAsync(s => s.StaffId == staff.Id);
        Assert.Equal(new DateTime(2026, 9, 1), updated.PeriodFrom);
        Assert.Equal(new DateTime(2026, 9, 22), updated.PeriodTo);
        Assert.Equal(22000m, updated.EnteredSalary);
        Assert.Equal("Updated period", updated.Notes);
    }

    [Fact]
    public async Task SettleSalary_UsesExactDisplayedFinancials()
    {
        var (db, service, _) = CreateTestContext();
        var staff = CreateStaff(db);
        var userId = Guid.NewGuid();

        var adv = new StaffAdvance
        {
            Id = Guid.NewGuid(),
            StaffId = staff.Id,
            Amount = 7000m,
            BalanceAmount = 7000m,
            AdvanceDate = new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Utc),
            Status = StaffAdvanceStatus.Outstanding,
            Reason = "September Advance"
        };
        db.StaffAdvances.Add(adv);
        await db.SaveChangesAsync();

        var settlement = await service.SettleSalaryAsync(new SettleStaffSalaryRequest
        {
            StaffId = staff.Id,
            PeriodFrom = "2026-09-01",
            PeriodTo = "2026-09-22",
            EnteredSalary = 20000m
        }, userId);

        Assert.Equal(20000m, settlement.EnteredSalary);
        Assert.Equal(7000m, settlement.OutstandingAdvanceBeforeSettlement);
        Assert.Equal(7000m, settlement.AdvanceDeduction);
        Assert.Equal(13000m, settlement.FinalSalary);
        Assert.Equal(0m, settlement.RemainingAdvanceAfterSettlement);
        Assert.Equal("Settled", settlement.Status);
    }
}
