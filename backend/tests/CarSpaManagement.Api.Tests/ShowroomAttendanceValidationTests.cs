using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class ShowroomAttendanceValidationTests
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
    public async Task ConfirmAttendanceAsync_ThrowsInvalidOperationException_WhenZeroStaffAssigned()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var showroomId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var date = DateTime.UtcNow.Date;

        var showroom = new Showroom
        {
            Id = showroomId,
            Name = "Popular Hyundai Showroom",
            Address = "Anna Salai, Chennai",
            Phone = "9876500001",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Showrooms.Add(showroom);
        await db.SaveChangesAsync();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.ConfirmAttendanceAsync(showroomId, date, userId));

        Assert.Contains("Please assign at least one staff member before confirming attendance.", ex.Message);
    }

    [Fact]
    public async Task ConfirmAttendanceAsync_Succeeds_WhenOneStaffAssigned()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var showroomId = Guid.NewGuid();
        var staffId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var date = DateTime.UtcNow.Date;

        var showroom = new Showroom
        {
            Id = showroomId,
            Name = "Popular Hyundai Showroom",
            Address = "Anna Salai, Chennai",
            Phone = "9876500001",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Showrooms.Add(showroom);

        var staff = new Staff
        {
            Id = staffId,
            Name = "Karthik Raja",
            PhoneNumber = "9876540001",
            Role = "Technician",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Staff.Add(staff);

        var assignment = new ShowroomStaffAssignment
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroomId,
            StaffId = staffId,
            Date = DateTime.SpecifyKind(date, DateTimeKind.Utc),
            VehiclesAttended = 4,
            CreatedAt = DateTime.UtcNow
        };
        db.ShowroomStaffAssignments.Add(assignment);
        await db.SaveChangesAsync();

        // Act
        var result = await service.ConfirmAttendanceAsync(showroomId, date, userId);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.IsAttendanceConfirmed);
        Assert.Single(result.StaffAssignments);
        Assert.Equal(4, result.TotalVehiclesAttended);
    }

    [Fact]
    public async Task ConfirmAttendanceAsync_Succeeds_WhenMultipleStaffAssigned()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var showroomId = Guid.NewGuid();
        var staff1Id = Guid.NewGuid();
        var staff2Id = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var date = DateTime.UtcNow.Date;

        var showroom = new Showroom
        {
            Id = showroomId,
            Name = "KUN BMW Showroom",
            Address = "OMR, Chennai",
            Phone = "9876500002",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Showrooms.Add(showroom);

        var staff1 = new Staff
        {
            Id = staff1Id,
            Name = "Karthik Raja",
            PhoneNumber = "9876540001",
            Role = "Technician",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        var staff2 = new Staff
        {
            Id = staff2Id,
            Name = "Senthil Nathan",
            PhoneNumber = "9876540002",
            Role = "Technician",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Staff.AddRange(staff1, staff2);

        var assignment1 = new ShowroomStaffAssignment
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroomId,
            StaffId = staff1Id,
            Date = DateTime.SpecifyKind(date, DateTimeKind.Utc),
            VehiclesAttended = 5,
            CreatedAt = DateTime.UtcNow
        };
        var assignment2 = new ShowroomStaffAssignment
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroomId,
            StaffId = staff2Id,
            Date = DateTime.SpecifyKind(date, DateTimeKind.Utc),
            VehiclesAttended = 3,
            CreatedAt = DateTime.UtcNow
        };
        db.ShowroomStaffAssignments.AddRange(assignment1, assignment2);
        await db.SaveChangesAsync();

        // Act
        var result = await service.ConfirmAttendanceAsync(showroomId, date, userId);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.IsAttendanceConfirmed);
        Assert.Equal(2, result.StaffAssignments.Count);
        Assert.Equal(8, result.TotalVehiclesAttended);
    }

    [Fact]
    public async Task Controller_ConfirmAttendance_ReturnsBadRequest_WhenZeroStaffAssigned()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var showroomId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var date = DateTime.UtcNow.Date;

        var showroom = new Showroom
        {
            Id = showroomId,
            Name = "Popular Hyundai Showroom",
            Address = "Anna Salai, Chennai",
            Phone = "9876500001",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Showrooms.Add(showroom);

        var user = new User
        {
            Id = userId,
            Username = "admin",
            FullName = "Admin User",
            Role = UserRole.Owner,
            PasswordHash = "hash",
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = new ShowroomsController(service, db);
        var httpContext = new DefaultHttpContext();
        httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, "Owner")
        }, "TestAuth"));
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        // Act
        var result = await controller.ConfirmAttendance(showroomId, date, null, CancellationToken.None);

        // Assert
        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(StatusCodes.Status400BadRequest, badRequestResult.StatusCode);
    }

    [Fact]
    public async Task AssignStaffAsync_WithStartAndEndTime_CalculatesWorkingHoursCorrectly()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var showroomId = Guid.NewGuid();
        var staffId = Guid.NewGuid();
        var date = new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc);

        var showroom = new Showroom
        {
            Id = showroomId,
            MasterId = "SK10001",
            Name = "Skoda Showroom",
            Address = "Salem",
            Phone = "9876500001",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        var staff = new Staff
        {
            Id = staffId,
            StaffMasterId = "RA101H",
            Name = "Ramesh",
            PhoneNumber = "9876540001",
            Role = "Technician",
            IsActive = true,
            DefaultShowroomId = showroomId,
            CreatedAt = DateTime.UtcNow
        };
        db.Showrooms.Add(showroom);
        db.Staff.Add(staff);
        await db.SaveChangesAsync();

        // Act - Ramesh assigned 09:00 to 14:00 (5 hours)
        var result = await service.AssignStaffAsync(showroomId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffId,
            Date = date,
            StartTime = "09:00",
            EndTime = "14:00",
            AssignmentType = "Regular"
        });

        // Assert
        Assert.NotNull(result);
        Assert.Equal("09:00", result.StartTime);
        Assert.Equal("14:00", result.EndTime);
        Assert.Equal(5.0, result.WorkingHours);
        Assert.Equal("5h", result.WorkingHoursFormatted);
        Assert.Equal("Regular", result.AssignmentType);
        Assert.Equal(showroomId, result.HomeShowroomId);
        Assert.Equal("Skoda Showroom", result.HomeShowroomName);
    }

    [Fact]
    public async Task AssignStaffAsync_TemporaryTransfer_PreservesHomeShowroomAndRecordsTransferReason()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var homeShowroomId = Guid.NewGuid();
        var targetShowroomId = Guid.NewGuid();
        var staffId = Guid.NewGuid();
        var date = new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc);

        var homeShowroom = new Showroom
        {
            Id = homeShowroomId,
            MasterId = "SA10001",
            Name = "Showroom A",
            Address = "Salem",
            Phone = "9876500001",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        var targetShowroom = new Showroom
        {
            Id = targetShowroomId,
            MasterId = "SK10001",
            Name = "Skoda",
            Address = "Salem",
            Phone = "9876500002",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        var staff = new Staff
        {
            Id = staffId,
            StaffMasterId = "KU102R",
            Name = "Kumar",
            PhoneNumber = "9876540002",
            Role = "Detailer",
            IsActive = true,
            DefaultShowroomId = homeShowroomId,
            CreatedAt = DateTime.UtcNow
        };
        db.Showrooms.AddRange(homeShowroom, targetShowroom);
        db.Staff.Add(staff);
        await db.SaveChangesAsync();

        // Act - Kumar transferred to Skoda 14:00 to 18:00
        var result = await service.AssignStaffAsync(targetShowroomId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffId,
            Date = date,
            StartTime = "14:00",
            EndTime = "18:00",
            AssignmentType = "TemporaryTransfer",
            TransferReason = "Covering for Ramesh who leaves after 14:00",
            Notes = "Approved by manager"
        });

        // Assert
        Assert.NotNull(result);
        Assert.Equal(targetShowroomId, result.ShowroomId);
        Assert.Equal("Skoda", result.ShowroomName);
        Assert.Equal(homeShowroomId, result.HomeShowroomId);
        Assert.Equal("Showroom A", result.HomeShowroomName);
        Assert.Equal("14:00", result.StartTime);
        Assert.Equal("18:00", result.EndTime);
        Assert.Equal(4.0, result.WorkingHours);
        Assert.Equal("4h", result.WorkingHoursFormatted);
        Assert.Equal("TemporaryTransfer", result.AssignmentType);
        Assert.Equal("Covering for Ramesh who leaves after 14:00", result.TransferReason);

        // Verify that Kumar's staff.DefaultShowroomId in DB is UNCHANGED
        var refreshedStaff = await db.Staff.FindAsync(staffId);
        Assert.NotNull(refreshedStaff);
        Assert.Equal(homeShowroomId, refreshedStaff.DefaultShowroomId);
    }

    [Fact]
    public async Task AssignStaffAsync_OverlappingTimeSessions_ThrowsValidationException()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var showroomAId = Guid.NewGuid();
        var showroomBId = Guid.NewGuid();
        var staffId = Guid.NewGuid();
        var date = new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc);

        var showroomA = new Showroom { Id = showroomAId, MasterId = "SA10001", Name = "Showroom A", Address = "Salem", Phone = "9876500001", IsActive = true, CreatedAt = DateTime.UtcNow };
        var showroomB = new Showroom { Id = showroomBId, MasterId = "SK10001", Name = "Skoda", Address = "Salem", Phone = "9876500002", IsActive = true, CreatedAt = DateTime.UtcNow };
        var staff = new Staff { Id = staffId, StaffMasterId = "KU102R", Name = "Kumar", PhoneNumber = "9876540002", Role = "Detailer", IsActive = true, DefaultShowroomId = showroomAId, CreatedAt = DateTime.UtcNow };

        db.Showrooms.AddRange(showroomA, showroomB);
        db.Staff.Add(staff);
        await db.SaveChangesAsync();

        // 1. Assign Kumar to Showroom A from 09:00 to 15:00
        await service.AssignStaffAsync(showroomAId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffId,
            Date = date,
            StartTime = "09:00",
            EndTime = "15:00",
            AssignmentType = "Regular"
        });

        // 2. Attempt to assign Kumar to Skoda from 14:00 to 18:00 (overlaps with 09:00-15:00)
        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.AssignStaffAsync(showroomBId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffId,
            Date = date,
            StartTime = "14:00",
            EndTime = "18:00",
            AssignmentType = "TemporaryTransfer",
            TransferReason = "Overlap test"
        }));

        Assert.Contains("already has an active assignment", ex.Message);
        Assert.Contains("Overlapping assignments are not allowed", ex.Message);
        Assert.Contains("Showroom A", ex.Message);
    }

    [Fact]
    public async Task AssignStaffAsync_AdjacentTimeSessions_Succeeds()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var showroomAId = Guid.NewGuid();
        var showroomBId = Guid.NewGuid();
        var staffId = Guid.NewGuid();
        var date = new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc);

        var showroomA = new Showroom { Id = showroomAId, MasterId = "SA10001", Name = "Showroom A", Address = "Salem", Phone = "9876500001", IsActive = true, CreatedAt = DateTime.UtcNow };
        var showroomB = new Showroom { Id = showroomBId, MasterId = "SK10001", Name = "Skoda", Address = "Salem", Phone = "9876500002", IsActive = true, CreatedAt = DateTime.UtcNow };
        var staff = new Staff { Id = staffId, StaffMasterId = "KU102R", Name = "Kumar", PhoneNumber = "9876540002", Role = "Detailer", IsActive = true, DefaultShowroomId = showroomAId, CreatedAt = DateTime.UtcNow };

        db.Showrooms.AddRange(showroomA, showroomB);
        db.Staff.Add(staff);
        await db.SaveChangesAsync();

        // 1. Assign Kumar to Showroom A: 09:00 to 14:00
        var session1 = await service.AssignStaffAsync(showroomAId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffId,
            Date = date,
            StartTime = "09:00",
            EndTime = "14:00",
            AssignmentType = "Regular"
        });
        Assert.NotNull(session1);

        // 2. Assign Kumar to Skoda: 14:00 to 18:00 (strictly adjacent, not overlapping)
        var session2 = await service.AssignStaffAsync(showroomBId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffId,
            Date = date,
            StartTime = "14:00",
            EndTime = "18:00",
            AssignmentType = "TemporaryTransfer",
            TransferReason = "Mid-day transfer"
        });
        Assert.NotNull(session2);
        Assert.Equal("14:00", session2.StartTime);
        Assert.Equal("18:00", session2.EndTime);

        // Verify DailyStaff query returns the appropriate session for each showroom
        var dailyStaffA = await service.GetDailyStaffAsync(showroomAId, date);
        Assert.Single(dailyStaffA.StaffAssignments);
        Assert.Equal("09:00", dailyStaffA.StaffAssignments[0].StartTime);
        Assert.Equal("14:00", dailyStaffA.StaffAssignments[0].EndTime);

        var dailyStaffB = await service.GetDailyStaffAsync(showroomBId, date);
        Assert.Single(dailyStaffB.StaffAssignments);
        Assert.Equal("14:00", dailyStaffB.StaffAssignments[0].StartTime);
        Assert.Equal("18:00", dailyStaffB.StaffAssignments[0].EndTime);
        Assert.Equal("TemporaryTransfer", dailyStaffB.StaffAssignments[0].AssignmentType);
    }

    [Fact]
    public async Task UpdateAssignmentAsync_UpdatesTimeAndWorkingHoursSuccessfully()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var showroomId = Guid.NewGuid();
        var staffId = Guid.NewGuid();
        var date = new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc);

        var showroom = new Showroom { Id = showroomId, MasterId = "SK10001", Name = "Skoda", Address = "Salem", Phone = "9876500001", IsActive = true, CreatedAt = DateTime.UtcNow };
        var staff = new Staff { Id = staffId, StaffMasterId = "RA101H", Name = "Ramesh", PhoneNumber = "9876540001", Role = "Detailer", IsActive = true, DefaultShowroomId = showroomId, CreatedAt = DateTime.UtcNow };

        db.Showrooms.Add(showroom);
        db.Staff.Add(staff);
        await db.SaveChangesAsync();

        var assignment = await service.AssignStaffAsync(showroomId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffId,
            Date = date,
            StartTime = "09:00",
            EndTime = "18:00",
            AssignmentType = "Regular"
        });
        Assert.Equal(9.0, assignment.WorkingHours);

        // Act: Update time to 09:00 -> 14:00
        var updated = await service.UpdateAssignmentAsync(assignment.Id, new UpdateDailyStaffAssignmentRequest
        {
            StartTime = "09:00",
            EndTime = "14:00",
            Status = "HalfDay"
        });

        // Assert
        Assert.NotNull(updated);
        Assert.Equal("09:00", updated.StartTime);
        Assert.Equal("14:00", updated.EndTime);
        Assert.Equal(5.0, updated.WorkingHours);
        Assert.Equal("5h", updated.WorkingHoursFormatted);
        Assert.Equal("HalfDay", updated.Status);
    }

    [Fact]
    public async Task UpdateAssignmentAsync_ThrowsValidationException_WhenEndTimeEarlierThanStartTime()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var showroomId = Guid.NewGuid();
        var staffId = Guid.NewGuid();
        var date = new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc);

        var showroom = new Showroom { Id = showroomId, MasterId = "SK10001", Name = "Skoda", Address = "Salem", Phone = "9876500001", IsActive = true, CreatedAt = DateTime.UtcNow };
        var staff = new Staff { Id = staffId, StaffMasterId = "RA101H", Name = "Ramesh", PhoneNumber = "9876540001", Role = "Detailer", IsActive = true, DefaultShowroomId = showroomId, CreatedAt = DateTime.UtcNow };

        db.Showrooms.Add(showroom);
        db.Staff.Add(staff);
        await db.SaveChangesAsync();

        var assignment = await service.AssignStaffAsync(showroomId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffId,
            Date = date,
            StartTime = "09:00",
            EndTime = "18:00",
            AssignmentType = "Regular"
        });

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.UpdateAssignmentAsync(assignment.Id, new UpdateDailyStaffAssignmentRequest
        {
            StartTime = "17:00",
            EndTime = "09:00"
        }));

        Assert.Contains("End Time must be later than Start Time", ex.Message);
    }

    [Fact]
    public async Task UpdateAssignmentAsync_ThrowsValidationException_WhenUpdatedTimesOverlapWithAnotherSession()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var showroomAId = Guid.NewGuid();
        var showroomBId = Guid.NewGuid();
        var staffId = Guid.NewGuid();
        var date = new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc);

        var showroomA = new Showroom { Id = showroomAId, MasterId = "SA10001", Name = "Showroom A", Address = "Salem", Phone = "9876500001", IsActive = true, CreatedAt = DateTime.UtcNow };
        var showroomB = new Showroom { Id = showroomBId, MasterId = "SK10001", Name = "Skoda", Address = "Salem", Phone = "9876500002", IsActive = true, CreatedAt = DateTime.UtcNow };
        var staff = new Staff { Id = staffId, StaffMasterId = "KU102R", Name = "Kumar", PhoneNumber = "9876540002", Role = "Detailer", IsActive = true, DefaultShowroomId = showroomAId, CreatedAt = DateTime.UtcNow };

        db.Showrooms.AddRange(showroomA, showroomB);
        db.Staff.Add(staff);
        await db.SaveChangesAsync();

        // 1. Session at Showroom A: 09:00 - 14:00
        var sessionA = await service.AssignStaffAsync(showroomAId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffId,
            Date = date,
            StartTime = "09:00",
            EndTime = "14:00",
            AssignmentType = "Regular"
        });

        // 2. Session at Skoda: 14:00 - 18:00
        var sessionB = await service.AssignStaffAsync(showroomBId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffId,
            Date = date,
            StartTime = "14:00",
            EndTime = "18:00",
            AssignmentType = "TemporaryTransfer",
            TransferReason = "Mid-day transfer"
        });

        // Act & Assert: Try updating sessionB to start at 13:00 (overlaps with sessionA 09:00-14:00)
        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.UpdateAssignmentAsync(sessionB.Id, new UpdateDailyStaffAssignmentRequest
        {
            StartTime = "13:00",
            EndTime = "18:00"
        }));

        Assert.Contains("already has an active assignment", ex.Message);
        Assert.Contains("Overlapping assignments are not allowed", ex.Message);
    }

    [Fact]
    public async Task AssignStaffAsync_SameStaffSameShowroom_OverlappingTime_ThrowsValidationException()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var showroomId = Guid.NewGuid();
        var staffId = Guid.NewGuid();
        var date = new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc);

        var showroom = new Showroom { Id = showroomId, MasterId = "SK10001", Name = "Skoda", Address = "Salem", Phone = "9876500001", IsActive = true, CreatedAt = DateTime.UtcNow };
        var staff = new Staff { Id = staffId, StaffMasterId = "RA101H", Name = "Ramesh", PhoneNumber = "9876540001", Role = "Detailer", IsActive = true, DefaultShowroomId = showroomId, CreatedAt = DateTime.UtcNow };

        db.Showrooms.Add(showroom);
        db.Staff.Add(staff);
        await db.SaveChangesAsync();

        // 1. Assign Ramesh 09:00 - 14:00 at Skoda
        await service.AssignStaffAsync(showroomId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffId,
            Date = date,
            StartTime = "09:00",
            EndTime = "14:00",
            AssignmentType = "Regular"
        });

        // 2. Attempt to assign Ramesh 12:00 - 16:00 at the SAME showroom (overlaps 09:00-14:00)
        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.AssignStaffAsync(showroomId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffId,
            Date = date,
            StartTime = "12:00",
            EndTime = "16:00",
            AssignmentType = "Regular"
        }));

        Assert.Contains("already has an active assignment", ex.Message);
        Assert.Contains("Overlapping assignments are not allowed", ex.Message);
    }

    [Fact]
    public async Task AssignStaffAsync_ThreeConsecutiveShowroomSessions_Succeeds()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var showroom1Id = Guid.NewGuid();
        var showroom2Id = Guid.NewGuid();
        var showroom3Id = Guid.NewGuid();
        var staffId = Guid.NewGuid();
        var date = new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc);

        var sr1 = new Showroom { Id = showroom1Id, MasterId = "SK10001", Name = "Skoda", Address = "Salem", Phone = "9876500001", IsActive = true, CreatedAt = DateTime.UtcNow };
        var sr2 = new Showroom { Id = showroom2Id, MasterId = "HO10001", Name = "Honda", Address = "Salem", Phone = "9876500002", IsActive = true, CreatedAt = DateTime.UtcNow };
        var sr3 = new Showroom { Id = showroom3Id, MasterId = "HY10001", Name = "Hyundai", Address = "Salem", Phone = "9876500003", IsActive = true, CreatedAt = DateTime.UtcNow };
        var staff = new Staff { Id = staffId, StaffMasterId = "RA101H", Name = "Ramesh", PhoneNumber = "9876540001", Role = "Detailer", IsActive = true, DefaultShowroomId = showroom1Id, CreatedAt = DateTime.UtcNow };

        db.Showrooms.AddRange(sr1, sr2, sr3);
        db.Staff.Add(staff);
        await db.SaveChangesAsync();

        // 1. 09:00 - 12:00 at Skoda
        var s1 = await service.AssignStaffAsync(showroom1Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffId,
            Date = date,
            StartTime = "09:00",
            EndTime = "12:00",
            AssignmentType = "Regular"
        });
        Assert.NotNull(s1);

        // 2. 12:00 - 15:00 at Honda
        var s2 = await service.AssignStaffAsync(showroom2Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffId,
            Date = date,
            StartTime = "12:00",
            EndTime = "15:00",
            AssignmentType = "TemporaryTransfer",
            TransferReason = "Mid-day coverage"
        });
        Assert.NotNull(s2);

        // 3. 15:00 - 18:00 at Hyundai
        var s3 = await service.AssignStaffAsync(showroom3Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffId,
            Date = date,
            StartTime = "15:00",
            EndTime = "18:00",
            AssignmentType = "TemporaryTransfer",
            TransferReason = "Evening rush"
        });
        Assert.NotNull(s3);

        // Verify all 3 sessions exist correctly in their respective showrooms
        var staffSr1 = await service.GetDailyStaffAsync(showroom1Id, date);
        var staffSr2 = await service.GetDailyStaffAsync(showroom2Id, date);
        var staffSr3 = await service.GetDailyStaffAsync(showroom3Id, date);

        Assert.Single(staffSr1!.StaffAssignments);
        Assert.Equal("09:00", staffSr1.StaffAssignments[0].StartTime);
        Assert.Equal("12:00", staffSr1.StaffAssignments[0].EndTime);

        Assert.Single(staffSr2!.StaffAssignments);
        Assert.Equal("12:00", staffSr2.StaffAssignments[0].StartTime);
        Assert.Equal("15:00", staffSr2.StaffAssignments[0].EndTime);

        Assert.Single(staffSr3!.StaffAssignments);
        Assert.Equal("15:00", staffSr3.StaffAssignments[0].StartTime);
        Assert.Equal("18:00", staffSr3.StaffAssignments[0].EndTime);
    }

    [Fact]
    public async Task AssignStaffAsync_DifferentStaffSameShowroomSameTime_Succeeds()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var showroomId = Guid.NewGuid();
        var staff1Id = Guid.NewGuid();
        var staff2Id = Guid.NewGuid();
        var date = new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc);

        var showroom = new Showroom { Id = showroomId, MasterId = "SK10001", Name = "Skoda", Address = "Salem", Phone = "9876500001", IsActive = true, CreatedAt = DateTime.UtcNow };
        var staff1 = new Staff { Id = staff1Id, StaffMasterId = "RA101H", Name = "Ramesh", PhoneNumber = "9876540001", Role = "Detailer", IsActive = true, DefaultShowroomId = showroomId, CreatedAt = DateTime.UtcNow };
        var staff2 = new Staff { Id = staff2Id, StaffMasterId = "SU102B", Name = "Suresh", PhoneNumber = "9876540002", Role = "Technician", IsActive = true, DefaultShowroomId = showroomId, CreatedAt = DateTime.UtcNow };

        db.Showrooms.Add(showroom);
        db.Staff.AddRange(staff1, staff2);
        await db.SaveChangesAsync();

        // 1. Assign Ramesh 09:00 - 18:00
        var s1 = await service.AssignStaffAsync(showroomId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff1Id,
            Date = date,
            StartTime = "09:00",
            EndTime = "18:00",
            AssignmentType = "Regular"
        });
        Assert.NotNull(s1);

        // 2. Assign Suresh 09:00 - 18:00 at same showroom
        var s2 = await service.AssignStaffAsync(showroomId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff2Id,
            Date = date,
            StartTime = "09:00",
            EndTime = "18:00",
            AssignmentType = "Regular"
        });
        Assert.NotNull(s2);

        var daily = await service.GetDailyStaffAsync(showroomId, date);
        Assert.Equal(2, daily!.StaffAssignments.Count);
    }

    [Fact]
    public async Task AssignStaffAsync_SameDisplayNameDifferentStaffIds_TreatedAsIndependentStaff()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var showroomAId = Guid.NewGuid();
        var showroomBId = Guid.NewGuid();
        var staff1Id = Guid.NewGuid();
        var staff2Id = Guid.NewGuid();
        var date = new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc);

        var srA = new Showroom { Id = showroomAId, MasterId = "SK10001", Name = "Skoda", Address = "Salem", Phone = "9876500001", IsActive = true, CreatedAt = DateTime.UtcNow };
        var srB = new Showroom { Id = showroomBId, MasterId = "HO10001", Name = "Honda", Address = "Salem", Phone = "9876500002", IsActive = true, CreatedAt = DateTime.UtcNow };

        // Two distinct staff records with identical display name "Aadhaar Test 2", but different IDs and Home Showrooms
        var staff1 = new Staff { Id = staff1Id, StaffMasterId = "AT101", Name = "Aadhaar Test 2", PhoneNumber = "9876540001", Role = "Detailer", IsActive = true, DefaultShowroomId = showroomAId, CreatedAt = DateTime.UtcNow };
        var staff2 = new Staff { Id = staff2Id, StaffMasterId = "AT102", Name = "Aadhaar Test 2", PhoneNumber = "9876540002", Role = "Detailer", IsActive = true, DefaultShowroomId = showroomBId, CreatedAt = DateTime.UtcNow };

        db.Showrooms.AddRange(srA, srB);
        db.Staff.AddRange(staff1, staff2);
        await db.SaveChangesAsync();

        // 1. Assign Staff 1 to Skoda: 09:00 - 18:00
        var s1 = await service.AssignStaffAsync(showroomAId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff1Id,
            Date = date,
            StartTime = "09:00",
            EndTime = "18:00",
            AssignmentType = "Regular"
        });
        Assert.NotNull(s1);
        Assert.Equal(showroomAId, s1.HomeShowroomId);

        // 2. Assign Staff 2 to Honda: 09:00 - 18:00
        var s2 = await service.AssignStaffAsync(showroomBId, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff2Id,
            Date = date,
            StartTime = "09:00",
            EndTime = "18:00",
            AssignmentType = "Regular"
        });
        Assert.NotNull(s2);
        Assert.Equal(showroomBId, s2.HomeShowroomId);

        // Assert: Both exist in their respective showrooms because they have different StaffIds
        var dailyA = await service.GetDailyStaffAsync(showroomAId, date);
        var dailyB = await service.GetDailyStaffAsync(showroomBId, date);

        Assert.Single(dailyA!.StaffAssignments);
        Assert.Equal(staff1Id, dailyA.StaffAssignments[0].StaffId);
        Assert.Equal("Skoda", dailyA.StaffAssignments[0].HomeShowroomName);

        Assert.Single(dailyB!.StaffAssignments);
        Assert.Equal(staff2Id, dailyB.StaffAssignments[0].StaffId);
        Assert.Equal("Honda", dailyB.StaffAssignments[0].HomeShowroomName);
    }

    [Fact]
    public async Task GetDailyStaffAsync_LegacyAssignmentDoesNotResurrectStaffAssignedElsewhere()
    {
        // Arrange
        var (db, service) = CreateTestContext();
        var showroomAId = Guid.NewGuid();
        var showroomBId = Guid.NewGuid();
        var staffId = Guid.NewGuid();
        var date = new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc);

        var srA = new Showroom { Id = showroomAId, MasterId = "SK10001", Name = "Skoda", Address = "Salem", Phone = "9876500001", IsActive = true, CreatedAt = DateTime.UtcNow };
        var srB = new Showroom { Id = showroomBId, MasterId = "HO10001", Name = "Honda", Address = "Salem", Phone = "9876500002", IsActive = true, CreatedAt = DateTime.UtcNow };
        var staff = new Staff { Id = staffId, StaffMasterId = "RA101H", Name = "Ramesh", PhoneNumber = "9876540001", Role = "Detailer", IsActive = true, DefaultShowroomId = showroomAId, CreatedAt = DateTime.UtcNow };

        db.Showrooms.AddRange(srA, srB);
        db.Staff.Add(staff);

        // Legacy assignment row in Honda
        var legacyAssignment = new ShowroomStaffAssignment
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroomBId,
            StaffId = staffId,
            Date = date,
            VehiclesAttended = 0,
            CreatedAt = DateTime.UtcNow
        };
        db.ShowroomStaffAssignments.Add(legacyAssignment);

        // Rich work session in Skoda: 09:00 - 18:00
        var session = new ShowroomStaffWorkSession
        {
            Id = Guid.NewGuid(),
            StaffId = staffId,
            WorkingShowroomId = showroomAId,
            HomeShowroomId = showroomAId,
            Date = date,
            StartTime = "09:00",
            EndTime = "18:00",
            SessionType = ShowroomStaffSessionType.FullDay,
            AttendanceStatus = StaffAttendanceStatus.Present,
            CreatedAt = DateTime.UtcNow
        };
        db.ShowroomStaffWorkSessions.Add(session);

        await db.SaveChangesAsync();

        // Act: Query daily staff for Honda (srB)
        var dailyB = await service.GetDailyStaffAsync(showroomBId, date);

        // Assert: Honda should NOT resurrect the legacy assignment because Ramesh has an active work session in Skoda on this date
        Assert.NotNull(dailyB);
        Assert.Empty(dailyB.StaffAssignments);

        // Query daily staff for Skoda (srA)
        var dailyA = await service.GetDailyStaffAsync(showroomAId, date);
        Assert.NotNull(dailyA);
        Assert.Single(dailyA.StaffAssignments);
        Assert.Equal(staffId, dailyA.StaffAssignments[0].StaffId);
    }
}
