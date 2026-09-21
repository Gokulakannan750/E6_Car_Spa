using System;
using System.Collections.Generic;
using System.Security.Claims;
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
}
