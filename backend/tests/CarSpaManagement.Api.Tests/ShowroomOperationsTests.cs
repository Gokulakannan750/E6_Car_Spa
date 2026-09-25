using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.DTOs.StaffAdvances;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class ShowroomOperationsTests
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

    private class DummyEncryptionService : IAesEncryptionService
    {
        public string? Encrypt(string? plainText) => plainText == null ? null : $"ENC_{plainText}";
        public string? Decrypt(string? cipherText) => cipherText == null ? null : (cipherText.StartsWith("ENC_") ? cipherText.Substring(4) : cipherText);
    }

    private static (AppDbContext db, IShowroomOperationsService opsService, IStaffAdvanceService staffService) CreateTestContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var db = new AppDbContext(options);
        var auditLogService = new DummyAuditLogService();
        var encryptionService = new DummyEncryptionService();

        var opsService = new ShowroomOperationsService(db, auditLogService);
        var staffService = new StaffAdvanceService(db, auditLogService, encryptionService);

        return (db, opsService, staffService);
    }

    private static async Task<(Showroom ShowroomA, Showroom ShowroomB, Staff Staff1, Staff Staff2, ShowroomVehicleType Hatchback, ShowroomVehicleType Sedan, ShowroomWorkType BodyWash, ShowroomWorkType InteriorClean)>
        SeedBasicOperationalDataAsync(AppDbContext db)
    {
        var showroomA = new Showroom
        {
            Id = Guid.NewGuid(),
            MasterId = "SA10001",
            Name = "Salem Main Showroom",
            Address = "123 Salem Bypass Road",
            Phone = "9876543210",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var showroomB = new Showroom
        {
            Id = Guid.NewGuid(),
            MasterId = "OM10001",
            Name = "Omalur Branch Showroom",
            Address = "456 Omalur Main Road",
            Phone = "9876543211",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var staff1 = new Staff
        {
            Id = Guid.NewGuid(),
            StaffMasterId = "KU101R",
            Name = "Kumar",
            PhoneNumber = "9876543201",
            Role = "Technician",
            IsActive = true,
            DefaultShowroomId = showroomA.Id,
            CreatedAt = DateTime.UtcNow
        };

        var staff2 = new Staff
        {
            Id = Guid.NewGuid(),
            StaffMasterId = "RA102H",
            Name = "Ramesh",
            PhoneNumber = "9876543202",
            Role = "Detailer",
            IsActive = true,
            DefaultShowroomId = showroomB.Id,
            CreatedAt = DateTime.UtcNow
        };

        var hatchback = new ShowroomVehicleType
        {
            Id = Guid.NewGuid(),
            Code = "HATCHBACK",
            Name = "Hatchback",
            DisplayOrder = 1,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var sedan = new ShowroomVehicleType
        {
            Id = Guid.NewGuid(),
            Code = "SEDAN",
            Name = "Sedan",
            DisplayOrder = 2,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var bodyWash = new ShowroomWorkType
        {
            Id = Guid.NewGuid(),
            Code = "BODY_WASH",
            Name = "Body Wash",
            Description = "Exterior foam wash and dry",
            DisplayOrder = 1,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var interiorClean = new ShowroomWorkType
        {
            Id = Guid.NewGuid(),
            Code = "INTERIOR_CLEANING",
            Name = "Interior Cleaning",
            Description = "Deep vacuum and dashboard dress",
            DisplayOrder = 2,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var today = DateTime.UtcNow.Date;
        var day1 = new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc);
        var day2 = new DateTime(2026, 9, 26, 0, 0, 0, DateTimeKind.Utc);

        var assignStaff1Today = new ShowroomStaffAssignment { Id = Guid.NewGuid(), ShowroomId = showroomA.Id, StaffId = staff1.Id, Date = today, VehiclesAttended = 0, CreatedAt = DateTime.UtcNow };
        var assignStaff2Today = new ShowroomStaffAssignment { Id = Guid.NewGuid(), ShowroomId = showroomA.Id, StaffId = staff2.Id, Date = today, VehiclesAttended = 0, CreatedAt = DateTime.UtcNow };
        var assignStaff1Day1 = new ShowroomStaffAssignment { Id = Guid.NewGuid(), ShowroomId = showroomA.Id, StaffId = staff1.Id, Date = day1, VehiclesAttended = 0, CreatedAt = DateTime.UtcNow };
        var assignStaff2Day1 = new ShowroomStaffAssignment { Id = Guid.NewGuid(), ShowroomId = showroomA.Id, StaffId = staff2.Id, Date = day1, VehiclesAttended = 0, CreatedAt = DateTime.UtcNow };
        var assignStaff1Day2 = new ShowroomStaffAssignment { Id = Guid.NewGuid(), ShowroomId = showroomA.Id, StaffId = staff1.Id, Date = day2, VehiclesAttended = 0, CreatedAt = DateTime.UtcNow };

        await db.Showrooms.AddRangeAsync(showroomA, showroomB);
        await db.Staff.AddRangeAsync(staff1, staff2);
        await db.ShowroomVehicleTypes.AddRangeAsync(hatchback, sedan);
        await db.ShowroomWorkTypes.AddRangeAsync(bodyWash, interiorClean);
        await db.ShowroomStaffAssignments.AddRangeAsync(assignStaff1Today, assignStaff2Today, assignStaff1Day1, assignStaff2Day1, assignStaff1Day2);
        await db.SaveChangesAsync();

        return (showroomA, showroomB, staff1, staff2, hatchback, sedan, bodyWash, interiorClean);
    }

    // ── Vehicle Types Tests ─────────────────────────────────────────────────

    [Fact]
    public async Task VehicleTypes_CanBeQueried_Created_Updated_And_Toggled()
    {
        var (db, opsService, _) = CreateTestContext();
        await SeedBasicOperationalDataAsync(db);

        // 1. Query Active Vehicle Types
        var types = await opsService.GetVehicleTypesAsync(isActive: true);
        Assert.Equal(2, types.Count);
        Assert.Contains(types, t => t.Code == "HATCHBACK");
        Assert.Contains(types, t => t.Code == "SEDAN");

        // 2. Create new vehicle type
        var suv = await opsService.CreateVehicleTypeAsync(new CreateShowroomVehicleTypeRequest
        {
            Code = "SUV",
            Name = "SUV / MUV",
            DisplayOrder = 3,
            IsActive = true
        });
        Assert.NotNull(suv);
        Assert.Equal("SUV", suv.Code);
        Assert.Equal("SUV / MUV", suv.Name);

        // 3. Update vehicle type
        var updated = await opsService.UpdateVehicleTypeAsync(suv.Id, new UpdateShowroomVehicleTypeRequest
        {
            Name = "SUV / Luxury",
            DisplayOrder = 4
        });
        Assert.NotNull(updated);
        Assert.Equal("SUV / Luxury", updated.Name);
        Assert.Equal(4, updated.DisplayOrder);

        // 4. Toggle active
        var toggled = await opsService.ToggleVehicleTypeActiveAsync(suv.Id);
        Assert.True(toggled);
        var inactiveSuv = await opsService.GetVehicleTypeByIdAsync(suv.Id);
        Assert.NotNull(inactiveSuv);
        Assert.False(inactiveSuv.IsActive);

        // 5. Query active only excludes inactive SUV
        var activeTypes = await opsService.GetVehicleTypesAsync(isActive: true);
        Assert.Equal(2, activeTypes.Count);
        Assert.DoesNotContain(activeTypes, t => t.Code == "SUV");
    }

    [Fact]
    public async Task VehicleType_DuplicateCode_ThrowsConflictException()
    {
        var (db, opsService, _) = CreateTestContext();
        await SeedBasicOperationalDataAsync(db);

        await Assert.ThrowsAsync<ConflictException>(() => opsService.CreateVehicleTypeAsync(new CreateShowroomVehicleTypeRequest
        {
            Code = "HATCHBACK",
            Name = "Duplicate Hatchback"
        }));
    }

    // ── Work Types Tests ────────────────────────────────────────────────────

    [Fact]
    public async Task WorkTypes_CanBeQueried_Created_Updated_And_Toggled()
    {
        var (db, opsService, _) = CreateTestContext();
        await SeedBasicOperationalDataAsync(db);

        // 1. Query Active Work Types
        var workTypes = await opsService.GetWorkTypesAsync(isActive: true);
        Assert.Equal(2, workTypes.Count);

        // 2. Create new work type
        var ceramic = await opsService.CreateWorkTypeAsync(new CreateShowroomWorkTypeRequest
        {
            Code = "CERAMIC_COATING",
            Name = "Ceramic Coating",
            Description = "9H multi-layer paint protection coating",
            DisplayOrder = 3,
            IsActive = true
        });
        Assert.NotNull(ceramic);
        Assert.Equal("CERAMIC_COATING", ceramic.Code);

        // 3. Update work type
        var updated = await opsService.UpdateWorkTypeAsync(ceramic.Id, new UpdateShowroomWorkTypeRequest
        {
            Description = "Premium 9H ceramic coating"
        });
        Assert.NotNull(updated);
        Assert.Equal("Premium 9H ceramic coating", updated.Description);

        // 4. Toggle active
        await opsService.ToggleWorkTypeActiveAsync(ceramic.Id);
        var activeWorkTypes = await opsService.GetWorkTypesAsync(isActive: true);
        Assert.Equal(2, activeWorkTypes.Count);
        Assert.DoesNotContain(activeWorkTypes, w => w.Code == "CERAMIC_COATING");
    }

    [Fact]
    public async Task WorkType_DuplicateCode_ThrowsConflictException()
    {
        var (db, opsService, _) = CreateTestContext();
        await SeedBasicOperationalDataAsync(db);

        await Assert.ThrowsAsync<ConflictException>(() => opsService.CreateWorkTypeAsync(new CreateShowroomWorkTypeRequest
        {
            Code = "BODY_WASH",
            Name = "Duplicate Body Wash"
        }));
    }

    // ── Staff Work Sessions Tests ───────────────────────────────────────────

    [Fact]
    public async Task WorkSession_CanBeCreated_Queried_And_Updated()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, showroomB, staff1, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);

        var today = DateTime.UtcNow.Date;

        // 1. Create work session at Showroom A (Home & Working = Showroom A)
        var session1 = await opsService.CreateWorkSessionAsync(showroomA.Id, new CreateShowroomStaffWorkSessionRequest
        {
            StaffId = staff1.Id,
            Date = today,
            SessionType = ShowroomStaffSessionType.Morning,
            AttendanceStatus = StaffAttendanceStatus.Present,
            StartTime = "09:00",
            EndTime = "13:00",
            Notes = "Morning shift at home showroom"
        });

        Assert.NotNull(session1);
        Assert.Equal(staff1.Id, session1.StaffId);
        Assert.Equal("KU101R", session1.StaffMasterId);
        Assert.Equal("Kumar", session1.StaffName);
        Assert.Equal(showroomA.Id, session1.HomeShowroomId);
        Assert.Equal("SA10001", session1.HomeShowroomMasterId);
        Assert.Equal(showroomA.Id, session1.WorkingShowroomId);
        Assert.Equal("SA10001", session1.WorkingShowroomMasterId);
        Assert.Equal(ShowroomStaffSessionType.Morning, session1.SessionType);

        // 2. Create inter-showroom transfer session: Kumar moves to Showroom B in the Afternoon
        var session2 = await opsService.CreateWorkSessionAsync(showroomB.Id, new CreateShowroomStaffWorkSessionRequest
        {
            StaffId = staff1.Id,
            HomeShowroomId = showroomA.Id,
            Date = today,
            SessionType = ShowroomStaffSessionType.Afternoon,
            AttendanceStatus = StaffAttendanceStatus.TemporaryTransfer,
            StartTime = "14:00",
            EndTime = "18:00",
            TransferReason = "Temporary coverage for heavy backlog",
            Notes = "Transferred from Showroom A"
        });

        Assert.NotNull(session2);
        Assert.Equal(staff1.Id, session2.StaffId);
        Assert.Equal(showroomA.Id, session2.HomeShowroomId);
        Assert.Equal(showroomB.Id, session2.WorkingShowroomId);
        Assert.Equal("OM10001", session2.WorkingShowroomMasterId);
        Assert.Equal(ShowroomStaffSessionType.Afternoon, session2.SessionType);
        Assert.Equal(StaffAttendanceStatus.TemporaryTransfer, session2.AttendanceStatus);

        // 3. Query sessions by Showroom
        var showroomASessions = await opsService.GetWorkSessionsAsync(showroomA.Id, date: today);
        Assert.Single(showroomASessions);
        Assert.Equal(session1.Id, showroomASessions[0].Id);

        var showroomBSessions = await opsService.GetWorkSessionsAsync(showroomB.Id, date: today);
        Assert.Single(showroomBSessions);
        Assert.Equal(session2.Id, showroomBSessions[0].Id);

        // 4. Update session
        var updatedSession = await opsService.UpdateWorkSessionAsync(showroomB.Id, session2.Id, new UpdateShowroomStaffWorkSessionRequest
        {
            EndTime = "19:00",
            Notes = "Overtime completed"
        });
        Assert.NotNull(updatedSession);
        Assert.Equal("19:00", updatedSession.EndTime);
        Assert.Equal("Overtime completed", updatedSession.Notes);
    }

    [Fact]
    public async Task WorkSession_DuplicateSession_ThrowsValidationException()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);

        var today = DateTime.UtcNow.Date;

        await opsService.CreateWorkSessionAsync(showroomA.Id, new CreateShowroomStaffWorkSessionRequest
        {
            StaffId = staff1.Id,
            Date = today,
            SessionType = ShowroomStaffSessionType.FullDay
        });

        // Duplicate attempt on the same day and session type (overlapping 09:00-18:00)
        var ex = await Assert.ThrowsAsync<ValidationException>(() => opsService.CreateWorkSessionAsync(showroomA.Id, new CreateShowroomStaffWorkSessionRequest
        {
            StaffId = staff1.Id,
            Date = today,
            SessionType = ShowroomStaffSessionType.FullDay
        }));

        Assert.Contains("already has an active assignment", ex.Message);
        Assert.Contains("Overlapping assignments are not allowed", ex.Message);
    }

    [Fact]
    public async Task WorkSession_InactiveShowroom_ThrowsValidationException()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);

        showroomA.IsActive = false;
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ValidationException>(() => opsService.CreateWorkSessionAsync(showroomA.Id, new CreateShowroomStaffWorkSessionRequest
        {
            StaffId = staff1.Id,
            Date = DateTime.UtcNow.Date,
            SessionType = ShowroomStaffSessionType.FullDay
        }));
    }

    [Fact]
    public async Task WorkSession_InvalidStaffOrShowroom_ThrowsKeyNotFoundException()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, _, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);

        // Non-existent staff ID
        await Assert.ThrowsAsync<KeyNotFoundException>(() => opsService.CreateWorkSessionAsync(showroomA.Id, new CreateShowroomStaffWorkSessionRequest
        {
            StaffId = Guid.NewGuid(),
            Date = DateTime.UtcNow.Date
        }));

        // Non-existent showroom ID
        await Assert.ThrowsAsync<KeyNotFoundException>(() => opsService.CreateWorkSessionAsync(Guid.NewGuid(), new CreateShowroomStaffWorkSessionRequest
        {
            StaffId = Guid.NewGuid(),
            Date = DateTime.UtcNow.Date
        }));
    }

    // ── Vehicle Work & Work Items Tests ─────────────────────────────────────

    [Fact]
    public async Task VehicleWork_CanBeCreated_WithLineItems_And_Queried()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, hatchback, _, bodyWash, interiorClean) = await SeedBasicOperationalDataAsync(db);

        var today = DateTime.UtcNow.Date;

        // 1. Create a work session
        var session = await opsService.CreateWorkSessionAsync(showroomA.Id, new CreateShowroomStaffWorkSessionRequest
        {
            StaffId = staff1.Id,
            Date = today,
            SessionType = ShowroomStaffSessionType.FullDay
        });

        // 2. Create vehicle work record: 2 Hatchbacks handled, each receiving Body Wash and Interior Cleaning
        var work = await opsService.CreateVehicleWorkAsync(showroomA.Id, new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff1.Id,
            VehicleTypeId = hatchback.Id,
            ShowroomStaffWorkSessionId = session.Id,
            VehicleQuantity = 2,
            Date = today,
            TimeRecorded = "11:30",
            Notes = "Customer express delivery wash",
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest>
            {
                new() { WorkTypeId = bodyWash.Id, Quantity = 2, Notes = "Foam wash" },
                new() { WorkTypeId = interiorClean.Id, Quantity = 2, Notes = "Vacuumed" }
            }
        });

        Assert.NotNull(work);
        Assert.Equal(showroomA.Id, work.ShowroomId);
        Assert.Equal("SA10001", work.ShowroomMasterId);
        Assert.Equal(staff1.Id, work.StaffId);
        Assert.Equal("KU101R", work.StaffMasterId);
        Assert.Equal(hatchback.Id, work.VehicleTypeId);
        Assert.Equal("HATCHBACK", work.VehicleTypeCode);
        Assert.Equal(2, work.VehicleQuantity);
        Assert.Equal(2, work.ServiceItems.Count);
        Assert.Contains(work.ServiceItems, i => i.WorkTypeCode == "BODY_WASH" && i.Quantity == 2);
        Assert.Contains(work.ServiceItems, i => i.WorkTypeCode == "INTERIOR_CLEANING" && i.Quantity == 2);

        // 3. Retrieve individual vehicle work by ID
        var retrieved = await opsService.GetVehicleWorkByIdAsync(showroomA.Id, work.Id);
        Assert.NotNull(retrieved);
        Assert.Equal(work.Id, retrieved.Id);
        Assert.Equal(2, retrieved.ServiceItems.Count);

        // 4. Retrieve list of vehicle works for showroom and date
        var worksList = await opsService.GetVehicleWorksAsync(showroomA.Id, date: today);
        Assert.Single(worksList);
        Assert.Equal(work.Id, worksList[0].Id);

        // 5. Update vehicle work line items
        var updated = await opsService.UpdateVehicleWorkAsync(showroomA.Id, work.Id, new UpdateShowroomVehicleWorkRequest
        {
            VehicleQuantity = 3,
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest>
            {
                new() { WorkTypeId = bodyWash.Id, Quantity = 3, Notes = "3 washes" }
            }
        });

        Assert.NotNull(updated);
        Assert.Equal(3, updated.VehicleQuantity);
        Assert.Single(updated.ServiceItems);
        Assert.Equal(3, updated.ServiceItems[0].Quantity);
    }

    [Fact]
    public async Task VehicleWork_InactiveShowroom_ThrowsValidationException()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, hatchback, _, _, _) = await SeedBasicOperationalDataAsync(db);

        showroomA.IsActive = false;
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ValidationException>(() => opsService.CreateVehicleWorkAsync(showroomA.Id, new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff1.Id,
            VehicleTypeId = hatchback.Id,
            VehicleQuantity = 1,
            Date = DateTime.UtcNow.Date
        }));
    }

    [Fact]
    public async Task WorkSession_InactiveStaff_ThrowsValidationException()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);

        staff1.IsActive = false;
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ValidationException>(() => opsService.CreateWorkSessionAsync(showroomA.Id, new CreateShowroomStaffWorkSessionRequest
        {
            StaffId = staff1.Id,
            Date = DateTime.UtcNow.Date,
            SessionType = ShowroomStaffSessionType.FullDay
        }));
    }

    [Fact]
    public async Task VehicleWork_InactiveStaff_ThrowsValidationException()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, hatchback, _, _, _) = await SeedBasicOperationalDataAsync(db);

        staff1.IsActive = false;
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ValidationException>(() => opsService.CreateVehicleWorkAsync(showroomA.Id, new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff1.Id,
            VehicleTypeId = hatchback.Id,
            VehicleQuantity = 1,
            Date = DateTime.UtcNow.Date
        }));
    }

    [Fact]
    public async Task VehicleWork_InactiveVehicleType_ThrowsValidationException()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, hatchback, _, _, _) = await SeedBasicOperationalDataAsync(db);

        hatchback.IsActive = false;
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ValidationException>(() => opsService.CreateVehicleWorkAsync(showroomA.Id, new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff1.Id,
            VehicleTypeId = hatchback.Id,
            VehicleQuantity = 1,
            Date = DateTime.UtcNow.Date
        }));
    }

    [Fact]
    public async Task VehicleWork_InactiveWorkType_ThrowsValidationException()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, hatchback, _, bodyWash, _) = await SeedBasicOperationalDataAsync(db);

        bodyWash.IsActive = false;
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ValidationException>(() => opsService.CreateVehicleWorkAsync(showroomA.Id, new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff1.Id,
            VehicleTypeId = hatchback.Id,
            VehicleQuantity = 1,
            Date = DateTime.UtcNow.Date,
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest>
            {
                new() { WorkTypeId = bodyWash.Id, Quantity = 1 }
            }
        }));
    }

    // ── Operations Summary & Productivity Tests ─────────────────────────────

    [Fact]
    public async Task OperationsSummary_CalculatesAggregatesCorrectly()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, staff2, hatchback, sedan, bodyWash, interiorClean) = await SeedBasicOperationalDataAsync(db);

        var today = DateTime.UtcNow.Date;

        // Staff 1 session + work
        var session1 = await opsService.CreateWorkSessionAsync(showroomA.Id, new CreateShowroomStaffWorkSessionRequest
        {
            StaffId = staff1.Id,
            Date = today,
            SessionType = ShowroomStaffSessionType.FullDay,
            AttendanceStatus = StaffAttendanceStatus.Present
        });

        await opsService.CreateVehicleWorkAsync(showroomA.Id, new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff1.Id,
            VehicleTypeId = hatchback.Id,
            ShowroomStaffWorkSessionId = session1.Id,
            VehicleQuantity = 3,
            Date = today,
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest>
            {
                new() { WorkTypeId = bodyWash.Id, Quantity = 3 },
                new() { WorkTypeId = interiorClean.Id, Quantity = 3 }
            }
        });

        // Staff 2 session + work
        var session2 = await opsService.CreateWorkSessionAsync(showroomA.Id, new CreateShowroomStaffWorkSessionRequest
        {
            StaffId = staff2.Id,
            Date = today,
            SessionType = ShowroomStaffSessionType.FullDay,
            AttendanceStatus = StaffAttendanceStatus.Present
        });

        await opsService.CreateVehicleWorkAsync(showroomA.Id, new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff2.Id,
            VehicleTypeId = sedan.Id,
            ShowroomStaffWorkSessionId = session2.Id,
            VehicleQuantity = 2,
            Date = today,
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest>
            {
                new() { WorkTypeId = bodyWash.Id, Quantity = 2 }
            }
        });

        // Get Summary
        var summary = await opsService.GetOperationsSummaryAsync(showroomA.Id, today, today);
        Assert.NotNull(summary);
        Assert.Equal(showroomA.Id, summary.ShowroomId);
        Assert.Equal("SA10001", summary.ShowroomMasterId);
        Assert.Equal(5, summary.TotalVehiclesHandled); // 3 hatchbacks + 2 sedans
        Assert.Equal(8, summary.TotalServicesPerformed); // 3 body + 3 interior + 2 body = 8 services
        Assert.Equal(2, summary.TotalActiveStaffSessions);

        // Vehicle breakdown
        Assert.Equal(2, summary.VehicleTypeBreakdown.Count);
        var hatchSummary = summary.VehicleTypeBreakdown.First(v => v.VehicleTypeCode == "HATCHBACK");
        Assert.Equal(3, hatchSummary.TotalVehicles);
        var sedanSummary = summary.VehicleTypeBreakdown.First(v => v.VehicleTypeCode == "SEDAN");
        Assert.Equal(2, sedanSummary.TotalVehicles);

        // Work type breakdown
        Assert.Equal(2, summary.WorkTypeBreakdown.Count);
        var bodySummary = summary.WorkTypeBreakdown.First(w => w.WorkTypeCode == "BODY_WASH");
        Assert.Equal(5, bodySummary.TotalQuantity); // 3 + 2 = 5
        var interiorSummary = summary.WorkTypeBreakdown.First(w => w.WorkTypeCode == "INTERIOR_CLEANING");
        Assert.Equal(3, interiorSummary.TotalQuantity);

        // Staff breakdown
        Assert.Equal(2, summary.StaffProductivityBreakdown.Count);
        var kumarSummary = summary.StaffProductivityBreakdown.First(s => s.StaffMasterId == "KU101R");
        Assert.Equal(3, kumarSummary.TotalVehiclesHandled);
        Assert.Equal(6, kumarSummary.TotalServicesPerformed);
    }

    // ── Staff Default Showroom Tests ────────────────────────────────────────

    [Fact]
    public async Task StaffDefaultShowroom_CanBeSet_Retrieved_And_Cleared()
    {
        var (db, opsService, staffService) = CreateTestContext();
        var (showroomA, showroomB, staff1, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);

        // 1. Initial default showroom is Showroom A
        var initial = await opsService.GetStaffDefaultShowroomAsync(staff1.Id);
        Assert.NotNull(initial);
        Assert.Equal(showroomA.Id, initial.DefaultShowroomId);
        Assert.Equal("SA10001", initial.DefaultShowroomMasterId);
        Assert.Equal("Salem Main Showroom", initial.DefaultShowroomName);

        // 2. Change default showroom to Showroom B
        var updated = await opsService.SetStaffDefaultShowroomAsync(staff1.Id, showroomB.Id);
        Assert.NotNull(updated);
        Assert.Equal(showroomB.Id, updated.DefaultShowroomId);
        Assert.Equal("OM10001", updated.DefaultShowroomMasterId);
        Assert.Equal("Omalur Branch Showroom", updated.DefaultShowroomName);

        // 3. Clear default showroom (set to null)
        var cleared = await opsService.SetStaffDefaultShowroomAsync(staff1.Id, null);
        Assert.NotNull(cleared);
        Assert.Null(cleared.DefaultShowroomId);
        Assert.Null(cleared.DefaultShowroomMasterId);
        Assert.Null(cleared.DefaultShowroomName);

        // 4. Verify via staff directory DTO that DefaultShowroomId is null
        var staffDto = await staffService.GetStaffByIdAsync(staff1.Id);
        Assert.NotNull(staffDto);
        Assert.Null(staffDto.DefaultShowroomId);
        Assert.Null(staffDto.DefaultShowroomMasterId);
        Assert.Null(staffDto.DefaultShowroomName);
    }

    [Fact]
    public async Task StaffDefaultShowroom_InvalidShowroom_ThrowsKeyNotFoundException()
    {
        var (db, opsService, _) = CreateTestContext();
        var (_, _, staff1, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => opsService.SetStaffDefaultShowroomAsync(staff1.Id, Guid.NewGuid()));
    }

    // ── Relational Integrity & Security / Permissions Tests ─────────────────

    [Fact]
    public void Architecture_ControllersAndEntities_RespectSecurityAndRelationalIntegrity()
    {
        // 1. Verify that internal Guid IDs are used for all foreign keys
        var sessionFkProps = typeof(ShowroomStaffWorkSession).GetProperties().Where(p => p.Name.EndsWith("Id")).Select(p => p.PropertyType);
        foreach (var propType in sessionFkProps)
        {
            Assert.True(propType == typeof(Guid) || propType == typeof(Guid?));
        }

        var vehicleWorkFkProps = typeof(ShowroomVehicleWork).GetProperties().Where(p => p.Name.EndsWith("Id")).Select(p => p.PropertyType);
        foreach (var propType in vehicleWorkFkProps)
        {
            Assert.True(propType == typeof(Guid) || propType == typeof(Guid?));
        }

        // 2. Verify that Master IDs in DTOs are string display fields only
        Assert.Equal(typeof(string), typeof(ShowroomStaffWorkSessionDto).GetProperty("StaffMasterId")!.PropertyType);
        Assert.Equal(typeof(string), typeof(ShowroomStaffWorkSessionDto).GetProperty("HomeShowroomMasterId")!.PropertyType);
        Assert.Equal(typeof(string), typeof(ShowroomStaffWorkSessionDto).GetProperty("WorkingShowroomMasterId")!.PropertyType);
        Assert.Equal(typeof(string), typeof(ShowroomVehicleWorkDto).GetProperty("ShowroomMasterId")!.PropertyType);
        Assert.Equal(typeof(string), typeof(ShowroomVehicleWorkDto).GetProperty("StaffMasterId")!.PropertyType);

        // 3. Verify that sensitive staff information (Aadhaar, document paths) is NOT exposed in operational DTOs
        var sessionDtoProps = typeof(ShowroomStaffWorkSessionDto).GetProperties().Select(p => p.Name);
        Assert.DoesNotContain("Aadhaar", sessionDtoProps, StringComparer.OrdinalIgnoreCase);
        Assert.DoesNotContain("DocumentPath", sessionDtoProps, StringComparer.OrdinalIgnoreCase);

        var vehicleWorkDtoProps = typeof(ShowroomVehicleWorkDto).GetProperties().Select(p => p.Name);
        Assert.DoesNotContain("Aadhaar", vehicleWorkDtoProps, StringComparer.OrdinalIgnoreCase);
        Assert.DoesNotContain("DocumentPath", vehicleWorkDtoProps, StringComparer.OrdinalIgnoreCase);

        // 4. Verify ShowroomsController does NOT have any DELETE showroom endpoint
        var showroomMethods = typeof(ShowroomsController).GetMethods();
        var hasDeleteShowroom = showroomMethods.Any(m => m.GetCustomAttributes(typeof(HttpDeleteAttribute), false).Any());
        Assert.False(hasDeleteShowroom, "ShowroomsController must NOT expose hard-delete showroom endpoints.");

        // 5. Verify ShowroomVehicleTypesController has [RequirePermission] attributes
        var vehicleTypesMethods = typeof(ShowroomVehicleTypesController).GetMethods().Where(m => m.DeclaringType == typeof(ShowroomVehicleTypesController));
        foreach (var method in vehicleTypesMethods)
        {
            var hasPerm = method.GetCustomAttributes(typeof(RequirePermissionAttribute), false).Any();
            Assert.True(hasPerm, $"Method {method.Name} in ShowroomVehicleTypesController must have [RequirePermission]");
        }

        // 6. Verify ShowroomWorkTypesController has [RequirePermission] attributes
        var workTypesMethods = typeof(ShowroomWorkTypesController).GetMethods().Where(m => m.DeclaringType == typeof(ShowroomWorkTypesController));
        foreach (var method in workTypesMethods)
        {
            var hasPerm = method.GetCustomAttributes(typeof(RequirePermissionAttribute), false).Any();
            Assert.True(hasPerm, $"Method {method.Name} in ShowroomWorkTypesController must have [RequirePermission]");
        }

        // 7. Verify ShowroomOperationsController has [RequirePermission] attributes
        var opsMethods = typeof(ShowroomOperationsController).GetMethods().Where(m => m.DeclaringType == typeof(ShowroomOperationsController));
        foreach (var method in opsMethods)
        {
            var hasPerm = method.GetCustomAttributes(typeof(RequirePermissionAttribute), false).Any();
            Assert.True(hasPerm, $"Method {method.Name} in ShowroomOperationsController must have [RequirePermission]");
        }
    }

    // ── Work Session Close Endpoint & Date Filter Tests ─────────────────────

    [Fact]
    public async Task CloseWorkSessionAsync_Service_ClosesSessionAndSetsEndTimeAndNotes()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var today = DateTime.UtcNow.Date;

        var session = await opsService.CreateWorkSessionAsync(showroomA.Id, new CreateShowroomStaffWorkSessionRequest
        {
            StaffId = staff1.Id,
            Date = today,
            SessionType = ShowroomStaffSessionType.FullDay,
            AttendanceStatus = StaffAttendanceStatus.Present,
            StartTime = "09:00"
        });

        var closed = await opsService.CloseWorkSessionAsync(showroomA.Id, session.Id, new CloseShowroomStaffWorkSessionRequest
        {
            EndTime = "17:30",
            Notes = "Completed full day shift on time"
        });

        Assert.NotNull(closed);
        Assert.Equal("17:30", closed.EndTime);
        Assert.Equal("Completed full day shift on time", closed.Notes);
    }

    [Fact]
    public void CloseWorkSession_Controller_HttpPostRoute_And_Permissions_Verified()
    {
        var controllerType = typeof(ShowroomOperationsController);
        var closeMethod = controllerType.GetMethod("CloseWorkSession");

        Assert.NotNull(closeMethod);

        // 1. Verify HttpPost route attribute
        var postAttr = closeMethod.GetCustomAttributes(typeof(HttpPostAttribute), false).Cast<HttpPostAttribute>().FirstOrDefault();
        Assert.NotNull(postAttr);
        Assert.Equal("work-sessions/{sessionId:guid}/close", postAttr.Template);

        // 2. Verify RequirePermission attribute
        var permAttr = closeMethod.GetCustomAttributes(typeof(RequirePermissionAttribute), false).Cast<RequirePermissionAttribute>().FirstOrDefault();
        Assert.NotNull(permAttr);
    }

    [Fact]
    public async Task CloseWorkSession_Controller_ValidSession_ReturnsOkWithUpdatedDto()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var today = DateTime.UtcNow.Date;

        var session = await opsService.CreateWorkSessionAsync(showroomA.Id, new CreateShowroomStaffWorkSessionRequest
        {
            StaffId = staff1.Id,
            Date = today,
            SessionType = ShowroomStaffSessionType.FullDay,
            AttendanceStatus = StaffAttendanceStatus.Present,
            StartTime = "09:00"
        });

        var controller = new ShowroomOperationsController(opsService);

        var actionResult = await controller.CloseWorkSession(showroomA.Id, session.Id, new CloseShowroomStaffWorkSessionRequest
        {
            EndTime = "18:00",
            Notes = "Shift closed via API"
        });

        var okResult = Assert.IsType<OkObjectResult>(actionResult);
        var dto = Assert.IsType<ShowroomStaffWorkSessionDto>(okResult.Value);
        Assert.Equal("18:00", dto.EndTime);
        Assert.Equal("Shift closed via API", dto.Notes);
    }

    [Fact]
    public async Task CloseWorkSession_Controller_InvalidSession_ReturnsNotFound()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, _, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);

        var controller = new ShowroomOperationsController(opsService);

        var actionResult = await controller.CloseWorkSession(showroomA.Id, Guid.NewGuid(), new CloseShowroomStaffWorkSessionRequest
        {
            EndTime = "18:00"
        });

        Assert.IsType<NotFoundObjectResult>(actionResult);
    }

    [Fact]
    public async Task GetOperationsSummary_Controller_DateParameter_ReturnsSingleDaySummary()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, hatchback, sedan, bodyWash, _) = await SeedBasicOperationalDataAsync(db);
        var day1 = new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc);
        var day2 = new DateTime(2026, 9, 26, 0, 0, 0, DateTimeKind.Utc);

        // Day 1 work: 3 hatchbacks
        await opsService.CreateVehicleWorkAsync(showroomA.Id, new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff1.Id,
            VehicleTypeId = hatchback.Id,
            VehicleQuantity = 3,
            Date = day1,
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest>
            {
                new() { WorkTypeId = bodyWash.Id, Quantity = 3 }
            }
        });

        // Day 2 work: 5 sedans
        await opsService.CreateVehicleWorkAsync(showroomA.Id, new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff1.Id,
            VehicleTypeId = sedan.Id,
            VehicleQuantity = 5,
            Date = day2,
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest>
            {
                new() { WorkTypeId = bodyWash.Id, Quantity = 5 }
            }
        });

        var controller = new ShowroomOperationsController(opsService);

        // Query single date: Day 1 (2026-09-25)
        var resultDay1 = await controller.GetOperationsSummary(showroomA.Id, date: day1);
        var okDay1 = Assert.IsType<OkObjectResult>(resultDay1);
        var summaryDay1 = Assert.IsType<ShowroomOperationsSummaryDto>(okDay1.Value);

        // Must ONLY return Day 1 count (3 hatchbacks), NOT including Day 2 (5 sedans)
        Assert.Equal(3, summaryDay1.TotalVehiclesHandled);
        Assert.Equal(3, summaryDay1.TotalServicesPerformed);

        // Query single date: Day 2 (2026-09-26)
        var resultDay2 = await controller.GetOperationsSummary(showroomA.Id, date: day2);
        var okDay2 = Assert.IsType<OkObjectResult>(resultDay2);
        var summaryDay2 = Assert.IsType<ShowroomOperationsSummaryDto>(okDay2.Value);

        // Must ONLY return Day 2 count (5 sedans)
        Assert.Equal(5, summaryDay2.TotalVehiclesHandled);
        Assert.Equal(5, summaryDay2.TotalServicesPerformed);
    }

    [Fact]
    public async Task GetOperationsSummary_Controller_FromDateToDate_ReturnsRangeSummary()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, hatchback, sedan, bodyWash, _) = await SeedBasicOperationalDataAsync(db);
        var day1 = new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc);
        var day2 = new DateTime(2026, 9, 26, 0, 0, 0, DateTimeKind.Utc);

        await opsService.CreateVehicleWorkAsync(showroomA.Id, new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff1.Id,
            VehicleTypeId = hatchback.Id,
            VehicleQuantity = 2,
            Date = day1,
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest> { new() { WorkTypeId = bodyWash.Id, Quantity = 2 } }
        });

        await opsService.CreateVehicleWorkAsync(showroomA.Id, new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff1.Id,
            VehicleTypeId = sedan.Id,
            VehicleQuantity = 3,
            Date = day2,
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest> { new() { WorkTypeId = bodyWash.Id, Quantity = 3 } }
        });

        var controller = new ShowroomOperationsController(opsService);

        // Query range across day1 and day2
        var rangeResult = await controller.GetOperationsSummary(showroomA.Id, date: null, fromDate: day1, toDate: day2);
        var okRange = Assert.IsType<OkObjectResult>(rangeResult);
        var rangeSummary = Assert.IsType<ShowroomOperationsSummaryDto>(okRange.Value);

        Assert.Equal(5, rangeSummary.TotalVehiclesHandled); // 2 + 3 = 5
    }

    // ── Batch Vehicle Work Tests ────────────────────────────────────────────

    [Fact]
    public async Task CreateBatchVehicleWorkAsync_SavesIndividualVehicles_WithIndependentTypesAndServices()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, hatchback, sedan, bodyWash, interiorClean) = await SeedBasicOperationalDataAsync(db);

        var request = new CreateBatchShowroomVehicleWorkRequest
        {
            StaffId = staff1.Id,
            Date = new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc),
            TimeRecorded = "14:30",
            Notes = "Batch work for 3 cars",
            Vehicles = new List<IndividualVehicleWorkEntry>
            {
                new()
                {
                    VehicleTypeId = hatchback.Id,
                    WorkTypeIds = new List<Guid> { bodyWash.Id, interiorClean.Id },
                    Notes = "Car 1: Both services"
                },
                new()
                {
                    VehicleTypeId = sedan.Id,
                    WorkTypeIds = new List<Guid> { bodyWash.Id },
                    Notes = "Car 2: Body wash only"
                },
                new()
                {
                    VehicleTypeId = sedan.Id,
                    WorkTypeIds = new List<Guid> { interiorClean.Id },
                    Notes = "Car 3: Interior clean only"
                }
            }
        };

        var createdWorks = await opsService.CreateBatchVehicleWorkAsync(showroomA.Id, request);

        // Assert 3 independent records were created
        Assert.Equal(3, createdWorks.Count);

        // Vehicle 1: Hatchback with 2 services
        var v1 = createdWorks[0];
        Assert.Equal(hatchback.Id, v1.VehicleTypeId);
        Assert.Equal(1, v1.VehicleQuantity);
        Assert.Equal(2, v1.ServiceItems.Count);
        Assert.Contains(v1.ServiceItems, si => si.WorkTypeId == bodyWash.Id && si.Quantity == 1);
        Assert.Contains(v1.ServiceItems, si => si.WorkTypeId == interiorClean.Id && si.Quantity == 1);

        // Vehicle 2: Sedan with 1 service (Body Wash)
        var v2 = createdWorks[1];
        Assert.Equal(sedan.Id, v2.VehicleTypeId);
        Assert.Equal(1, v2.VehicleQuantity);
        Assert.Single(v2.ServiceItems);
        Assert.Equal(bodyWash.Id, v2.ServiceItems[0].WorkTypeId);

        // Vehicle 3: Sedan with 1 service (Interior Clean)
        var v3 = createdWorks[2];
        Assert.Equal(sedan.Id, v3.VehicleTypeId);
        Assert.Equal(1, v3.VehicleQuantity);
        Assert.Single(v3.ServiceItems);
        Assert.Equal(interiorClean.Id, v3.ServiceItems[0].WorkTypeId);

        // Verify summary reflects all 3 vehicles and 4 total services
        var summary = await opsService.GetOperationsSummaryAsync(showroomA.Id, new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 9, 25, 23, 59, 59, DateTimeKind.Utc));
        Assert.Equal(3, summary.TotalVehiclesHandled);
        Assert.Equal(4, summary.TotalServicesPerformed);
    }

    [Fact]
    public async Task CreateBatchVehicleWorkAsync_Throws_WhenVehiclesListEmpty()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);

        var request = new CreateBatchShowroomVehicleWorkRequest
        {
            StaffId = staff1.Id,
            Date = DateTime.UtcNow,
            Vehicles = new List<IndividualVehicleWorkEntry>()
        };

        await Assert.ThrowsAsync<ValidationException>(() => opsService.CreateBatchVehicleWorkAsync(showroomA.Id, request));
    }

    [Fact]
    public async Task CreateBatchVehicleWorkAsync_Throws_WhenVehicleHasNoServices()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, hatchback, _, _, _) = await SeedBasicOperationalDataAsync(db);

        var request = new CreateBatchShowroomVehicleWorkRequest
        {
            StaffId = staff1.Id,
            Date = DateTime.UtcNow,
            Vehicles = new List<IndividualVehicleWorkEntry>
            {
                new()
                {
                    VehicleTypeId = hatchback.Id,
                    WorkTypeIds = new List<Guid>() // Empty services
                }
            }
        };

        var ex = await Assert.ThrowsAsync<ValidationException>(() => opsService.CreateBatchVehicleWorkAsync(showroomA.Id, request));
        Assert.Contains("Vehicle 1: Select at least one service", ex.Message);
    }

    [Fact]
    public async Task CreateBatchVehicleWorkController_ReturnsCreatedDtos()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, staff1, _, hatchback, _, bodyWash, _) = await SeedBasicOperationalDataAsync(db);

        var controller = new ShowroomOperationsController(opsService);
        var request = new CreateBatchShowroomVehicleWorkRequest
        {
            StaffId = staff1.Id,
            Date = DateTime.UtcNow,
            Vehicles = new List<IndividualVehicleWorkEntry>
            {
                new()
                {
                    VehicleTypeId = hatchback.Id,
                    WorkTypeIds = new List<Guid> { bodyWash.Id }
                }
            }
        };

        var result = await controller.CreateBatchVehicleWork(showroomA.Id, request);
        var created = Assert.IsType<OkObjectResult>(result);
        var list = Assert.IsAssignableFrom<IReadOnlyList<ShowroomVehicleWorkDto>>(created.Value);
        Assert.Single(list);
    }

    // ── Staff Daily Attendance Validation on Vehicle Work Tests ─────────────

    [Fact]
    public async Task CreateVehicleWorkAsync_StaffNotAssignedToAttendance_ThrowsValidationException()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, _, staff2, hatchback, _, bodyWash, _) = await SeedBasicOperationalDataAsync(db);

        // Date where staff2 is NOT assigned to Showroom A
        var unassignedDate = new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc);

        var request = new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff2.Id,
            VehicleTypeId = hatchback.Id,
            VehicleQuantity = 1,
            Date = unassignedDate,
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest>
            {
                new() { WorkTypeId = bodyWash.Id, Quantity = 1 }
            }
        };

        var ex = await Assert.ThrowsAsync<ValidationException>(() => opsService.CreateVehicleWorkAsync(showroomA.Id, request));
        Assert.Contains("is not assigned to showroom", ex.Message);
        Assert.Contains("in daily staff attendance", ex.Message);
    }

    [Fact]
    public async Task CreateVehicleWorkAsync_StaffAssignedToDifferentShowroom_ThrowsValidationException()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, showroomB, _, staff2, hatchback, _, bodyWash, _) = await SeedBasicOperationalDataAsync(db);

        var date = new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc);

        // Assign staff2 to Showroom B only
        db.ShowroomStaffAssignments.Add(new ShowroomStaffAssignment
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroomB.Id,
            StaffId = staff2.Id,
            Date = date,
            VehiclesAttended = 0,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        // Attempt to log vehicle work for staff2 at Showroom A
        var request = new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff2.Id,
            VehicleTypeId = hatchback.Id,
            VehicleQuantity = 1,
            Date = date,
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest>
            {
                new() { WorkTypeId = bodyWash.Id, Quantity = 1 }
            }
        };

        var ex = await Assert.ThrowsAsync<ValidationException>(() => opsService.CreateVehicleWorkAsync(showroomA.Id, request));
        Assert.Contains("is not assigned to showroom", ex.Message);
    }

    [Fact]
    public async Task CreateBatchVehicleWorkAsync_StaffNotAssignedToAttendance_ThrowsValidationException()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, _, staff2, hatchback, _, bodyWash, _) = await SeedBasicOperationalDataAsync(db);

        var unassignedDate = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);

        var request = new CreateBatchShowroomVehicleWorkRequest
        {
            StaffId = staff2.Id,
            Date = unassignedDate,
            Vehicles = new List<IndividualVehicleWorkEntry>
            {
                new()
                {
                    VehicleTypeId = hatchback.Id,
                    WorkTypeIds = new List<Guid> { bodyWash.Id }
                }
            }
        };

        var ex = await Assert.ThrowsAsync<ValidationException>(() => opsService.CreateBatchVehicleWorkAsync(showroomA.Id, request));
        Assert.Contains("is not assigned to showroom", ex.Message);
        Assert.Contains("in daily staff attendance", ex.Message);
    }

    [Fact]
    public async Task CreateVehicleWorkAsync_StaffAssignedInAttendance_Succeeds()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, _, _, staff2, hatchback, _, bodyWash, _) = await SeedBasicOperationalDataAsync(db);

        var targetDate = new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc);

        // Assign staff2 to Showroom A on targetDate in attendance
        db.ShowroomStaffAssignments.Add(new ShowroomStaffAssignment
        {
            Id = Guid.NewGuid(),
            ShowroomId = showroomA.Id,
            StaffId = staff2.Id,
            Date = targetDate,
            VehiclesAttended = 0,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var request = new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff2.Id,
            VehicleTypeId = hatchback.Id,
            VehicleQuantity = 1,
            Date = targetDate,
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest>
            {
                new() { WorkTypeId = bodyWash.Id, Quantity = 1 }
            }
        };

        var result = await opsService.CreateVehicleWorkAsync(showroomA.Id, request);
        Assert.NotNull(result);
        Assert.Equal(staff2.Id, result.StaffId);
        Assert.Equal("RA102H", result.StaffMasterId);
    }

    // ── Phase 2: Time-Based Staff Switching & Cross-Showroom Transfer Tests ──

    [Fact]
    public async Task AssignStaffAsync_BasicSession_CreatesWorkSessionWithWorkingHours()
    {
        var (db, _, _) = CreateTestContext();
        var (showroomA, showroomB, _, staff2, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var showroomService = new ShowroomService(db, new DummyAuditLogService());

        var targetDate = new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc);
        var request = new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff2.Id,
            Date = targetDate,
            StartTime = "09:00",
            EndTime = "14:00",
            AssignmentType = "Regular"
        };

        var result = await showroomService.AssignStaffAsync(showroomB.Id, request);
        Assert.NotNull(result);
        Assert.Equal("09:00", result.StartTime);
        Assert.Equal("14:00", result.EndTime);
        Assert.Equal(5.0, result.WorkingHours);
        Assert.Equal("5h", result.WorkingHoursFormatted);
        Assert.Equal("Present", result.Status);

        var sessionInDb = await db.ShowroomStaffWorkSessions.FirstOrDefaultAsync(s => s.Id == result.Id);
        Assert.NotNull(sessionInDb);
        Assert.Equal(showroomB.Id, sessionInDb.WorkingShowroomId);
        Assert.Equal(showroomB.Id, sessionInDb.HomeShowroomId);
        Assert.Equal("09:00", sessionInDb.StartTime);
        Assert.Equal("14:00", sessionInDb.EndTime);
    }

    [Fact]
    public async Task AssignStaffAsync_TemporaryTransfer_PreservesDefaultShowroomId()
    {
        var (db, _, _) = CreateTestContext();
        var (showroomA, showroomB, staff1, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var showroomService = new ShowroomService(db, new DummyAuditLogService());

        // staff1 default showroom is Showroom A
        Assert.Equal(showroomA.Id, staff1.DefaultShowroomId);

        var targetDate = new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc);
        var request = new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff1.Id,
            Date = targetDate,
            StartTime = "14:00",
            EndTime = "18:00",
            AssignmentType = "TemporaryTransfer",
            TransferReason = "Replacing morning staff for afternoon shift"
        };

        var result = await showroomService.AssignStaffAsync(showroomB.Id, request);
        Assert.NotNull(result);
        Assert.Equal("14:00", result.StartTime);
        Assert.Equal("18:00", result.EndTime);
        Assert.Equal(4.0, result.WorkingHours);
        Assert.Equal("4h", result.WorkingHoursFormatted);
        Assert.Equal("TemporaryTransfer", result.AssignmentType);
        Assert.Equal(showroomA.Id, result.HomeShowroomId);
        Assert.Equal("Salem Main Showroom", result.HomeShowroomName);
        Assert.Equal("Replacing morning staff for afternoon shift", result.TransferReason);

        // Crucial requirement: Staff.DefaultShowroomId must NOT change
        var staffAfter = await db.Staff.FindAsync(staff1.Id);
        Assert.NotNull(staffAfter);
        Assert.Equal(showroomA.Id, staffAfter.DefaultShowroomId);
    }

    [Fact]
    public async Task AssignStaffAsync_OverlappingTimes_ThrowsValidationException()
    {
        var (db, _, _) = CreateTestContext();
        var (showroomA, showroomB, staff1, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var showroomService = new ShowroomService(db, new DummyAuditLogService());

        var targetDate = new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc);

        // 1. Assign staff1 to Showroom A from 09:00 to 14:00
        await showroomService.AssignStaffAsync(showroomA.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff1.Id,
            Date = targetDate,
            StartTime = "09:00",
            EndTime = "14:00",
            AssignmentType = "Regular"
        });

        // 2. Attempt to assign staff1 to Showroom B with overlapping time 12:00 to 16:00
        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            showroomService.AssignStaffAsync(showroomB.Id, new CreateDailyStaffAssignmentRequest
            {
                StaffId = staff1.Id,
                Date = targetDate,
                StartTime = "12:00",
                EndTime = "16:00",
                AssignmentType = "TemporaryTransfer",
                TransferReason = "Mid-day overlap"
            }));

        Assert.Contains("already has an active assignment", ex.Message);
        Assert.Contains("Overlapping assignments are not allowed", ex.Message);
    }

    [Fact]
    public async Task SameDaySwitch_BothSessionsCoexistAtShowroom()
    {
        var (db, _, _) = CreateTestContext();
        var (showroomA, showroomB, staff1, staff2, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var showroomService = new ShowroomService(db, new DummyAuditLogService());

        var targetDate = new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc);

        // Staff 2 (Ramesh): 09:00–14:00 at Showroom B (Home = Showroom B)
        var s1 = await showroomService.AssignStaffAsync(showroomB.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff2.Id,
            Date = targetDate,
            StartTime = "09:00",
            EndTime = "14:00",
            AssignmentType = "Regular"
        });

        // Staff 1 (Kumar): 14:00–18:00 at Showroom B (Home = Showroom A, Transfer)
        var s2 = await showroomService.AssignStaffAsync(showroomB.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff1.Id,
            Date = targetDate,
            StartTime = "14:00",
            EndTime = "18:00",
            AssignmentType = "TemporaryTransfer",
            TransferReason = "Covering for Ramesh"
        });

        var daily = await showroomService.GetDailyStaffAsync(showroomB.Id, targetDate);
        Assert.NotNull(daily);
        Assert.Equal(2, daily.StaffAssignments.Count);

        var rameshAssignment = daily.StaffAssignments.First(a => a.StaffId == staff2.Id);
        var kumarAssignment = daily.StaffAssignments.First(a => a.StaffId == staff1.Id);

        Assert.Equal("09:00", rameshAssignment.StartTime);
        Assert.Equal("14:00", rameshAssignment.EndTime);
        Assert.Equal(5.0, rameshAssignment.WorkingHours);
        Assert.Equal("Regular", rameshAssignment.AssignmentType);

        Assert.Equal("14:00", kumarAssignment.StartTime);
        Assert.Equal("18:00", kumarAssignment.EndTime);
        Assert.Equal(4.0, kumarAssignment.WorkingHours);
        Assert.Equal("TemporaryTransfer", kumarAssignment.AssignmentType);
        Assert.Equal(showroomA.Id, kumarAssignment.HomeShowroomId);
    }

    [Fact]
    public async Task CreateVehicleWork_ResolvesSessionByTimeRecorded()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, showroomB, staff1, staff2, hatchback, _, bodyWash, _) = await SeedBasicOperationalDataAsync(db);
        var showroomService = new ShowroomService(db, new DummyAuditLogService());

        var targetDate = new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc);

        // Ramesh (staff2): 09:00–14:00 at Showroom B
        var session1 = await showroomService.AssignStaffAsync(showroomB.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff2.Id,
            Date = targetDate,
            StartTime = "09:00",
            EndTime = "14:00",
            AssignmentType = "Regular"
        });

        // Kumar (staff1): 14:00–18:00 at Showroom B
        var session2 = await showroomService.AssignStaffAsync(showroomB.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff1.Id,
            Date = targetDate,
            StartTime = "14:00",
            EndTime = "18:00",
            AssignmentType = "TemporaryTransfer",
            TransferReason = "Afternoon shift"
        });

        // 1. Vehicle work logged for Ramesh at 11:00
        var morningWork = await opsService.CreateVehicleWorkAsync(showroomB.Id, new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff2.Id,
            VehicleTypeId = hatchback.Id,
            VehicleQuantity = 1,
            Date = targetDate,
            TimeRecorded = "11:00",
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest>
            {
                new() { WorkTypeId = bodyWash.Id, Quantity = 1 }
            }
        });

        // 2. Vehicle work logged for Kumar at 15:30
        var afternoonWork = await opsService.CreateVehicleWorkAsync(showroomB.Id, new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff1.Id,
            VehicleTypeId = hatchback.Id,
            VehicleQuantity = 1,
            Date = targetDate,
            TimeRecorded = "15:30",
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest>
            {
                new() { WorkTypeId = bodyWash.Id, Quantity = 1 }
            }
        });

        Assert.Equal(session1.Id, morningWork.ShowroomStaffWorkSessionId);
        Assert.Equal(staff2.Id, morningWork.StaffId);

        Assert.Equal(session2.Id, afternoonWork.ShowroomStaffWorkSessionId);
        Assert.Equal(staff1.Id, afternoonWork.StaffId);
    }

    [Fact]
    public async Task HistoricalStability_EditingAfternoonTransfer_PreservesMorningVehicleWork()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomA, showroomB, staff1, staff2, hatchback, _, bodyWash, _) = await SeedBasicOperationalDataAsync(db);
        var showroomService = new ShowroomService(db, new DummyAuditLogService());

        var targetDate = new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc);

        var session1 = await showroomService.AssignStaffAsync(showroomB.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff2.Id,
            Date = targetDate,
            StartTime = "09:00",
            EndTime = "14:00",
            AssignmentType = "Regular"
        });

        var session2 = await showroomService.AssignStaffAsync(showroomB.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff1.Id,
            Date = targetDate,
            StartTime = "14:00",
            EndTime = "18:00",
            AssignmentType = "TemporaryTransfer",
            TransferReason = "Covering shift"
        });

        // Morning vehicle work
        var morningWork = await opsService.CreateVehicleWorkAsync(showroomB.Id, new CreateShowroomVehicleWorkRequest
        {
            StaffId = staff2.Id,
            VehicleTypeId = hatchback.Id,
            VehicleQuantity = 1,
            Date = targetDate,
            TimeRecorded = "11:00",
            ServiceItems = new List<CreateShowroomVehicleWorkItemRequest>
            {
                new() { WorkTypeId = bodyWash.Id, Quantity = 1 }
            }
        });

        // Modify afternoon session (e.g. adjust end time to 17:00)
        await showroomService.UpdateAssignmentAsync(session2.Id, new UpdateDailyStaffAssignmentRequest
        {
            StartTime = "14:00",
            EndTime = "17:00",
            TransferReason = "Left early at 17:00"
        });

        // Verify morning work remains 100% stable and associated with Ramesh and session1
        var reloadedWork = await opsService.GetVehicleWorkByIdAsync(showroomB.Id, morningWork.Id);
        Assert.NotNull(reloadedWork);
        Assert.Equal(staff2.Id, reloadedWork.StaffId);
        Assert.Equal(session1.Id, reloadedWork.ShowroomStaffWorkSessionId);
        Assert.Equal("RA102H", reloadedWork.StaffMasterId);
    }

    [Fact]
    public async Task MultipleSessions_SameStaffDifferentShowrooms_AllValid()
    {
        var (db, _, _) = CreateTestContext();
        var (showroomA, showroomB, staff1, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var showroomService = new ShowroomService(db, new DummyAuditLogService());

        var targetDate = new DateTime(2026, 10, 19, 0, 0, 0, DateTimeKind.Utc);

        // Session 1: 09:00–12:00 at Showroom A
        var s1 = await showroomService.AssignStaffAsync(showroomA.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff1.Id,
            Date = targetDate,
            StartTime = "09:00",
            EndTime = "12:00",
            AssignmentType = "Regular"
        });

        // Session 2: 12:00–15:00 at Showroom B (Transfer)
        var s2 = await showroomService.AssignStaffAsync(showroomB.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff1.Id,
            Date = targetDate,
            StartTime = "12:00",
            EndTime = "15:00",
            AssignmentType = "TemporaryTransfer",
            TransferReason = "Mid-day assist"
        });

        // Session 3: 15:00–18:00 at Showroom A (Back to Home Showroom)
        var s3 = await showroomService.AssignStaffAsync(showroomA.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staff1.Id,
            Date = targetDate,
            StartTime = "15:00",
            EndTime = "18:00",
            AssignmentType = "Regular"
        });

        Assert.NotNull(s1);
        Assert.NotNull(s2);
        Assert.NotNull(s3);

        // Showroom A should have session 1 and session 3
        var srAStaff = await showroomService.GetDailyStaffAsync(showroomA.Id, targetDate);
        Assert.NotNull(srAStaff);
        var srASessions = srAStaff.StaffAssignments.Where(a => a.StaffId == staff1.Id).ToList();
        Assert.Equal(2, srASessions.Count);

        // Showroom B should have session 2
        var srBStaff = await showroomService.GetDailyStaffAsync(showroomB.Id, targetDate);
        Assert.NotNull(srBStaff);
        var srBSessions = srBStaff.StaffAssignments.Where(a => a.StaffId == staff1.Id).ToList();
        Assert.Single(srBSessions);
        Assert.Equal("12:00", srBSessions[0].StartTime);
        Assert.Equal("15:00", srBSessions[0].EndTime);
        Assert.Equal(3.0, srBSessions[0].WorkingHours);
    }

    // =========================================================================
    // SECTION 9: TIME-BASED OVERLAP & GLOBAL STAFF VALIDATION TESTS (10 TESTS)
    // =========================================================================

    // Test 1: Same staff + same showroom + overlapping time -> rejected.
    [Fact]
    public async Task Overlap_1_SameStaff_SameShowroom_OverlappingTime_ThrowsValidationException()
    {
        var (db, opsService, _) = CreateTestContext();
        var showroomService = new ShowroomService(db, new DummyAuditLogService());
        var (showroomSkoda, _, staffRamesh, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var today = DateTime.UtcNow.Date;

        // Skoda 09:00–14:00
        await showroomService.AssignStaffAsync(showroomSkoda.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffRamesh.Id,
            Date = today,
            StartTime = "09:00",
            EndTime = "14:00"
        });

        // Attempt: Skoda 10:00–12:00
        var ex = await Assert.ThrowsAsync<ValidationException>(() => showroomService.AssignStaffAsync(showroomSkoda.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffRamesh.Id,
            Date = today,
            StartTime = "10:00",
            EndTime = "12:00"
        }));

        Assert.Contains("already has an active assignment", ex.Message);
        Assert.Contains("Overlapping assignments are not allowed", ex.Message);
    }

    // Test 2: Same staff + different showroom + overlapping time -> rejected.
    [Theory]
    [InlineData("10:00", "13:00")] // Subset overlap
    [InlineData("09:00", "14:00")] // Exact same overlap
    [InlineData("13:00", "16:00")] // Partial end overlap
    [InlineData("08:00", "10:00")] // Partial start overlap
    [InlineData("13:59", "18:00")] // Boundary minute overlap
    public async Task Overlap_2_SameStaff_DifferentShowroom_OverlappingTime_ThrowsValidationException(string newStart, string newEnd)
    {
        var (db, opsService, _) = CreateTestContext();
        var showroomService = new ShowroomService(db, new DummyAuditLogService());
        var (showroomSkoda, showroomHonda, staffRamesh, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var today = DateTime.UtcNow.Date;

        // Skoda 09:00–14:00
        await showroomService.AssignStaffAsync(showroomSkoda.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffRamesh.Id,
            Date = today,
            StartTime = "09:00",
            EndTime = "14:00"
        });

        // Attempt: Honda overlapping
        var ex = await Assert.ThrowsAsync<ValidationException>(() => showroomService.AssignStaffAsync(showroomHonda.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffRamesh.Id,
            Date = today,
            StartTime = newStart,
            EndTime = newEnd,
            AssignmentType = "TemporaryTransfer"
        }));

        Assert.Contains("already has an active assignment", ex.Message);
        Assert.Contains("Overlapping assignments are not allowed", ex.Message);
    }

    // Test 3: Same staff + different showroom + exact boundary -> allowed.
    [Fact]
    public async Task Overlap_3_SameStaff_DifferentShowroom_ExactBoundary_Allowed()
    {
        var (db, opsService, _) = CreateTestContext();
        var showroomService = new ShowroomService(db, new DummyAuditLogService());
        var (showroomSkoda, showroomHonda, staffRamesh, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var today = DateTime.UtcNow.Date;

        // Skoda 09:00–14:00
        var s1 = await showroomService.AssignStaffAsync(showroomSkoda.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffRamesh.Id,
            Date = today,
            StartTime = "09:00",
            EndTime = "14:00"
        });

        // Honda 14:00–18:00 (Exact boundary at 14:00)
        var s2 = await showroomService.AssignStaffAsync(showroomHonda.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffRamesh.Id,
            Date = today,
            StartTime = "14:00",
            EndTime = "18:00",
            AssignmentType = "TemporaryTransfer"
        });

        Assert.NotNull(s1);
        Assert.NotNull(s2);
        Assert.Equal("09:00", s1.StartTime);
        Assert.Equal("14:00", s1.EndTime);
        Assert.Equal("14:00", s2.StartTime);
        Assert.Equal("18:00", s2.EndTime);
    }

    // Test 4: Same staff + multiple consecutive showrooms -> allowed.
    [Fact]
    public async Task Overlap_4_SameStaff_MultipleConsecutiveShowrooms_Allowed()
    {
        var (db, opsService, _) = CreateTestContext();
        var showroomService = new ShowroomService(db, new DummyAuditLogService());
        var (showroomSkoda, showroomHonda, staffRamesh, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var showroomToyota = new Showroom { Id = Guid.NewGuid(), MasterId = "TO10001", Name = "Toyota", Address = "Salem", Phone = "9876500003", IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Showrooms.Add(showroomToyota);
        await db.SaveChangesAsync();

        var today = DateTime.UtcNow.Date;

        // Ramesh: Skoda 09:00–12:00, Honda 12:00–15:00, Toyota 15:00–18:00
        var s1 = await showroomService.AssignStaffAsync(showroomSkoda.Id, new CreateDailyStaffAssignmentRequest { StaffId = staffRamesh.Id, Date = today, StartTime = "09:00", EndTime = "12:00" });
        var s2 = await showroomService.AssignStaffAsync(showroomHonda.Id, new CreateDailyStaffAssignmentRequest { StaffId = staffRamesh.Id, Date = today, StartTime = "12:00", EndTime = "15:00", AssignmentType = "TemporaryTransfer" });
        var s3 = await showroomService.AssignStaffAsync(showroomToyota.Id, new CreateDailyStaffAssignmentRequest { StaffId = staffRamesh.Id, Date = today, StartTime = "15:00", EndTime = "18:00", AssignmentType = "TemporaryTransfer" });

        Assert.NotNull(s1);
        Assert.NotNull(s2);
        Assert.NotNull(s3);
    }

    // Test 5: Different staff + same showroom + same time -> allowed.
    [Fact]
    public async Task Overlap_5_DifferentStaff_SameShowroom_SameTime_Allowed()
    {
        var (db, opsService, _) = CreateTestContext();
        var showroomService = new ShowroomService(db, new DummyAuditLogService());
        var (showroomSkoda, _, staffRamesh, staffKumar, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var today = DateTime.UtcNow.Date;

        // Ramesh: Skoda 09:00–14:00
        var s1 = await showroomService.AssignStaffAsync(showroomSkoda.Id, new CreateDailyStaffAssignmentRequest { StaffId = staffRamesh.Id, Date = today, StartTime = "09:00", EndTime = "14:00" });
        // Kumar: Skoda 09:00–14:00
        var s2 = await showroomService.AssignStaffAsync(showroomSkoda.Id, new CreateDailyStaffAssignmentRequest { StaffId = staffKumar.Id, Date = today, StartTime = "09:00", EndTime = "14:00" });

        Assert.NotNull(s1);
        Assert.NotNull(s2);
    }

    // Test 6: Edit existing session without changing overlap -> allowed.
    [Fact]
    public async Task Overlap_6_EditExistingSession_WithoutNewOverlap_Allowed()
    {
        var (db, opsService, _) = CreateTestContext();
        var showroomService = new ShowroomService(db, new DummyAuditLogService());
        var (showroomSkoda, _, staffRamesh, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var today = DateTime.UtcNow.Date;

        var s1 = await showroomService.AssignStaffAsync(showroomSkoda.Id, new CreateDailyStaffAssignmentRequest { StaffId = staffRamesh.Id, Date = today, StartTime = "09:00", EndTime = "14:00" });

        // Edit session from 09:00-14:00 to 09:30-14:30
        var updated = await showroomService.UpdateAssignmentAsync(s1.Id, new UpdateDailyStaffAssignmentRequest { StartTime = "09:30", EndTime = "14:30" });

        Assert.NotNull(updated);
        Assert.Equal("09:30", updated.StartTime);
        Assert.Equal("14:30", updated.EndTime);
    }

    // Test 7: Edit session into another showroom's existing session -> rejected.
    [Fact]
    public async Task Overlap_7_EditSession_IntoAnotherShowroomSession_ThrowsValidationException()
    {
        var (db, opsService, _) = CreateTestContext();
        var showroomService = new ShowroomService(db, new DummyAuditLogService());
        var (showroomSkoda, showroomHonda, staffRamesh, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var today = DateTime.UtcNow.Date;

        // Session 1: Skoda 09:00–14:00
        var s1 = await showroomService.AssignStaffAsync(showroomSkoda.Id, new CreateDailyStaffAssignmentRequest { StaffId = staffRamesh.Id, Date = today, StartTime = "09:00", EndTime = "14:00" });
        // Session 2: Honda 14:00–18:00
        var s2 = await showroomService.AssignStaffAsync(showroomHonda.Id, new CreateDailyStaffAssignmentRequest { StaffId = staffRamesh.Id, Date = today, StartTime = "14:00", EndTime = "18:00", AssignmentType = "TemporaryTransfer" });

        // Attempt editing s1 to 10:00–15:00 (overlaps with s2 14:00-18:00 at 14:00-15:00)
        var ex = await Assert.ThrowsAsync<ValidationException>(() => showroomService.UpdateAssignmentAsync(s1.Id, new UpdateDailyStaffAssignmentRequest { StartTime = "10:00", EndTime = "15:00" }));

        Assert.Contains("already has an active assignment", ex.Message);
        Assert.Contains("Overlapping assignments are not allowed", ex.Message);
    }

    // Test 8: Staff with morning Skoda session cannot be assigned to Honda during that morning.
    [Fact]
    public async Task Overlap_8_MorningSkodaSession_CannotAssignToHondaDuringMorning()
    {
        var (db, opsService, _) = CreateTestContext();
        var (showroomSkoda, showroomHonda, staffRamesh, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var today = DateTime.UtcNow.Date;

        // Morning session at Skoda via operations service (09:00-13:00 default or explicit)
        await opsService.CreateWorkSessionAsync(showroomSkoda.Id, new CreateShowroomStaffWorkSessionRequest
        {
            StaffId = staffRamesh.Id,
            Date = today,
            SessionType = ShowroomStaffSessionType.Morning,
            StartTime = "09:00",
            EndTime = "13:00"
        });

        // Attempt assigning Ramesh to Honda from 10:00–12:00
        var ex = await Assert.ThrowsAsync<ValidationException>(() => opsService.CreateWorkSessionAsync(showroomHonda.Id, new CreateShowroomStaffWorkSessionRequest
        {
            StaffId = staffRamesh.Id,
            Date = today,
            SessionType = ShowroomStaffSessionType.Custom,
            StartTime = "10:00",
            EndTime = "12:00"
        }));

        Assert.Contains("already has an active assignment", ex.Message);
    }

    // Test 9: Temporary transfer after original session ends -> allowed.
    [Fact]
    public async Task Overlap_9_TemporaryTransfer_AfterOriginalSessionEnds_Allowed()
    {
        var (db, opsService, _) = CreateTestContext();
        var showroomService = new ShowroomService(db, new DummyAuditLogService());
        var (showroomSkoda, showroomHonda, staffRamesh, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var today = DateTime.UtcNow.Date;

        // Ramesh works morning shift at Skoda (09:00–14:00)
        var s1 = await showroomService.AssignStaffAsync(showroomSkoda.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffRamesh.Id,
            Date = today,
            StartTime = "09:00",
            EndTime = "14:00",
            AssignmentType = "Regular"
        });

        // Temporary transfer to Honda after 14:00 (14:00–18:00)
        var s2 = await showroomService.AssignStaffAsync(showroomHonda.Id, new CreateDailyStaffAssignmentRequest
        {
            StaffId = staffRamesh.Id,
            Date = today,
            StartTime = "14:00",
            EndTime = "18:00",
            AssignmentType = "TemporaryTransfer",
            TransferReason = "Afternoon peak assist"
        });

        Assert.NotNull(s1);
        Assert.NotNull(s2);
        Assert.Equal("TemporaryTransfer", s2.AssignmentType);
    }

    // Test 10: Three consecutive showroom sessions -> allowed.
    [Fact]
    public async Task Overlap_10_ThreeConsecutiveShowroomSessions_Allowed()
    {
        var (db, opsService, _) = CreateTestContext();
        var showroomService = new ShowroomService(db, new DummyAuditLogService());
        var (showroomSkoda, showroomHonda, staffRamesh, _, _, _, _, _) = await SeedBasicOperationalDataAsync(db);
        var showroomToyota = new Showroom { Id = Guid.NewGuid(), MasterId = "TO10001", Name = "Toyota Showroom", Address = "Salem", Phone = "9876500003", IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Showrooms.Add(showroomToyota);
        await db.SaveChangesAsync();

        var today = DateTime.UtcNow.Date;

        // Session 1: 09:00–12:00 at Skoda
        var s1 = await showroomService.AssignStaffAsync(showroomSkoda.Id, new CreateDailyStaffAssignmentRequest { StaffId = staffRamesh.Id, Date = today, StartTime = "09:00", EndTime = "12:00", AssignmentType = "Regular" });
        // Session 2: 12:00–15:00 at Honda
        var s2 = await showroomService.AssignStaffAsync(showroomHonda.Id, new CreateDailyStaffAssignmentRequest { StaffId = staffRamesh.Id, Date = today, StartTime = "12:00", EndTime = "15:00", AssignmentType = "TemporaryTransfer" });
        // Session 3: 15:00–18:00 at Toyota
        var s3 = await showroomService.AssignStaffAsync(showroomToyota.Id, new CreateDailyStaffAssignmentRequest { StaffId = staffRamesh.Id, Date = today, StartTime = "15:00", EndTime = "18:00", AssignmentType = "TemporaryTransfer" });

        Assert.NotNull(s1);
        Assert.NotNull(s2);
        Assert.NotNull(s3);
        Assert.Equal(3.0, s1.WorkingHours);
        Assert.Equal(3.0, s2.WorkingHours);
        Assert.Equal(3.0, s3.WorkingHours);
    }
}
