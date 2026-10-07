using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.DTOs.Settings;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.DTOs.StaffAttendance;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using JobCardServiceApp = CarSpaManagement.Api.Application.Services.JobCardService;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// RBAC Security Hardening Phase 2F test suite:
/// - 2F-01: Audit trail hardening for price overrides and discounts (JobCardService).
/// - 2F-02: Declarative Owner authorization ([Authorize(Roles = "Owner")]).
/// - 2F-03: Consistent database-backed Owner verification in Showroom controllers.
/// - 2F-05: Negative 403 integration tests & Owner positive tests across Owner-only endpoints.
/// </summary>
public class RbacPhase2fSecurityTests
{
    private class DummyAuditLogService : IAuditLogService
    {
        public List<AuditLog> RecordedLogs { get; } = new();

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
            RecordedLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                Action = action,
                Module = module,
                Description = description,
                EntityType = entityType,
                EntityId = entityId,
                EntityReference = entityReference,
                OldValues = oldValues,
                NewValues = newValues,
                Outcome = outcome,
                CreatedAt = DateTime.UtcNow
            });
            return Task.CompletedTask;
        }

        public Task<PagedResult<AuditLogDto>> GetLogsAsync(
            AuditLogQueryParameters query,
            CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();
    }

    private static AppDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static ClaimsPrincipal CreatePrincipal(Guid userId, string role, bool isOwner = false)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new("sub", userId.ToString()),
            new(ClaimTypes.Role, role),
            new("role", role),
            new("isOwner", isOwner ? "true" : "false")
        };
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
    }

    private static void SetCaller(ControllerBase controller, Guid userId, string role, bool isOwner = false)
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = CreatePrincipal(userId, role, isOwner)
            }
        };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 2F-01: AUDIT TRAIL HARDENING FOR PRICE OVERRIDES AND LINE DISCOUNTS
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task JobCardCreate_CataloguePrice_AuditPayload_HasNoPriceOverrides()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var service = new JobCardServiceApp(db, audit);

        var customer = new Customer { Id = Guid.NewGuid(), Name = "Alice", PhoneNumber = "9988776655" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN01AA1111", Make = "Honda", Model = "City" };
        var svc = new Service { Id = Guid.NewGuid(), Name = "Wash", Price = 500m, TaxPercentage = 18m, IsActive = true };
        db.AddRange(customer, vehicle, svc);
        await db.SaveChangesAsync();

        var req = new CreateJobCardRequest
        {
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = svc.Id, Quantity = 1, UnitPrice = 500m, DiscountAmount = 0 }
            }
        };

        var result = await service.CreateAsync(req, canOverridePrice: false);
        Assert.NotNull(result);

        var log = audit.RecordedLogs.FirstOrDefault(l => l.Action == "jobcards.create");
        Assert.NotNull(log);
        Assert.NotNull(log!.NewValues);

        using var doc = JsonDocument.Parse(log.NewValues!);
        var root = doc.RootElement;
        Assert.False(root.GetProperty("hasPriceOverrides").GetBoolean());
        Assert.Equal(0, root.GetProperty("priceOverrides").GetArrayLength());
        Assert.False(root.GetProperty("hasLineDiscounts").GetBoolean());
        Assert.Equal(0, root.GetProperty("lineDiscounts").GetArrayLength());
    }

    [Fact]
    public async Task JobCardCreate_AuthorizedPriceOverride_RecordsStructuredOverrideDetails()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var service = new JobCardServiceApp(db, audit);

        var customer = new Customer { Id = Guid.NewGuid(), Name = "Bob", PhoneNumber = "9988776655" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN01BB2222", Make = "Hyundai", Model = "Creta" };
        var svc = new Service { Id = Guid.NewGuid(), Name = "Full Detailing", Price = 3000m, TaxPercentage = 18m, IsActive = true };
        db.AddRange(customer, vehicle, svc);
        await db.SaveChangesAsync();

        var req = new CreateJobCardRequest
        {
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = svc.Id, Quantity = 2, UnitPrice = 2500m, DiscountAmount = 0 } // Overridden from 3000 to 2500
            }
        };

        var result = await service.CreateAsync(req, canOverridePrice: true);
        Assert.NotNull(result);

        var log = audit.RecordedLogs.FirstOrDefault(l => l.Action == "jobcards.create");
        Assert.NotNull(log);
        Assert.NotNull(log!.NewValues);

        using var doc = JsonDocument.Parse(log.NewValues!);
        var root = doc.RootElement;
        Assert.True(root.GetProperty("hasPriceOverrides").GetBoolean());

        var overrides = root.GetProperty("priceOverrides");
        Assert.Equal(1, overrides.GetArrayLength());
        var ov = overrides[0];
        Assert.Equal(svc.Id.ToString(), ov.GetProperty("serviceId").GetString());
        Assert.Equal("Full Detailing", ov.GetProperty("serviceName").GetString());
        Assert.Equal(3000m, ov.GetProperty("cataloguePrice").GetDecimal());
        Assert.Equal(2500m, ov.GetProperty("overriddenPrice").GetDecimal());
        Assert.Equal(-500m, ov.GetProperty("priceDifference").GetDecimal());
        Assert.Equal(2, ov.GetProperty("quantity").GetInt32());
    }

    [Fact]
    public async Task JobCardCreate_UnauthorizedPriceOverride_ThrowsForbiddenAndWritesNoAudit()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var service = new JobCardServiceApp(db, audit);

        var customer = new Customer { Id = Guid.NewGuid(), Name = "Charlie", PhoneNumber = "9988776655" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN01CC3333", Make = "Tata", Model = "Nexon" };
        var svc = new Service { Id = Guid.NewGuid(), Name = "Foam Wash", Price = 400m, TaxPercentage = 18m, IsActive = true };
        db.AddRange(customer, vehicle, svc);
        await db.SaveChangesAsync();

        var req = new CreateJobCardRequest
        {
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = svc.Id, Quantity = 1, UnitPrice = 300m, DiscountAmount = 0 }
            }
        };

        await Assert.ThrowsAsync<ForbiddenException>(() => service.CreateAsync(req, canOverridePrice: false));
        Assert.Empty(audit.RecordedLogs);
    }

    [Fact]
    public async Task JobCardCreate_LineDiscount_RecordsStructuredDiscountDetails()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var service = new JobCardServiceApp(db, audit);

        var customer = new Customer { Id = Guid.NewGuid(), Name = "David", PhoneNumber = "9988776655" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN01DD4444", Make = "Toyota", Model = "Innova" };
        var svc = new Service { Id = Guid.NewGuid(), Name = "Wax Polish", Price = 800m, TaxPercentage = 18m, IsActive = true };
        db.AddRange(customer, vehicle, svc);
        await db.SaveChangesAsync();

        var req = new CreateJobCardRequest
        {
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = svc.Id, Quantity = 1, UnitPrice = 800m, DiscountAmount = 100m }
            }
        };

        var result = await service.CreateAsync(req, canOverridePrice: false);
        Assert.NotNull(result);

        var log = audit.RecordedLogs.FirstOrDefault(l => l.Action == "jobcards.create");
        Assert.NotNull(log);
        using var doc = JsonDocument.Parse(log!.NewValues!);
        var root = doc.RootElement;
        Assert.False(root.GetProperty("hasPriceOverrides").GetBoolean());
        Assert.True(root.GetProperty("hasLineDiscounts").GetBoolean());

        var discounts = root.GetProperty("lineDiscounts");
        Assert.Equal(1, discounts.GetArrayLength());
        var disc = discounts[0];
        Assert.Equal(svc.Id.ToString(), disc.GetProperty("serviceId").GetString());
        Assert.Equal("Wax Polish", disc.GetProperty("serviceName").GetString());
        Assert.Equal(100m, disc.GetProperty("discountAmount").GetDecimal());
    }

    [Fact]
    public async Task JobCardUpdate_PriceOverrideAndDiscount_RecordsOldAndNewValues()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var service = new JobCardServiceApp(db, audit);

        var customer = new Customer { Id = Guid.NewGuid(), Name = "Eve", PhoneNumber = "9988776655" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN01EE5555", Make = "Kia", Model = "Seltos" };
        var svc1 = new Service { Id = Guid.NewGuid(), Name = "Interior Cleaning", Price = 1000m, TaxPercentage = 18m, IsActive = true };
        var svc2 = new Service { Id = Guid.NewGuid(), Name = "Windshield Coating", Price = 600m, TaxPercentage = 18m, IsActive = true };
        db.AddRange(customer, vehicle, svc1, svc2);
        await db.SaveChangesAsync();

        var created = await service.CreateAsync(new CreateJobCardRequest
        {
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = svc1.Id, Quantity = 1, UnitPrice = 1000m, DiscountAmount = 0 }
            }
        }, canOverridePrice: false);

        // Act: Update services with svc1 discounted and svc2 price overridden
        var updateReq = new UpdateJobCardServicesRequest
        {
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = svc1.Id, Quantity = 1, UnitPrice = 1000m, DiscountAmount = 150m },
                new() { ServiceId = svc2.Id, Quantity = 1, UnitPrice = 450m, DiscountAmount = 0 } // Overridden from 600 to 450
            }
        };

        var updated = await service.UpdateServicesAsync(created.Id, updateReq, canOverridePrice: true);
        Assert.NotNull(updated);

        var editLog = audit.RecordedLogs.FirstOrDefault(l => l.Action == "jobcards.edit");
        Assert.NotNull(editLog);
        Assert.NotNull(editLog!.OldValues);
        Assert.NotNull(editLog!.NewValues);

        using var oldDoc = JsonDocument.Parse(editLog.OldValues!);
        var oldServices = oldDoc.RootElement.GetProperty("services");
        Assert.Equal(1, oldServices.GetArrayLength());

        using var newDoc = JsonDocument.Parse(editLog.NewValues!);
        var newRoot = newDoc.RootElement;
        Assert.True(newRoot.GetProperty("hasPriceOverrides").GetBoolean());
        Assert.True(newRoot.GetProperty("hasLineDiscounts").GetBoolean());

        var priceOverrides = newRoot.GetProperty("priceOverrides");
        Assert.Equal(1, priceOverrides.GetArrayLength());
        Assert.Equal(svc2.Id.ToString(), priceOverrides[0].GetProperty("serviceId").GetString());
        Assert.Equal(600m, priceOverrides[0].GetProperty("cataloguePrice").GetDecimal());
        Assert.Equal(450m, priceOverrides[0].GetProperty("overriddenPrice").GetDecimal());
    }

    [Fact]
    public async Task JobCardCreate_FailedOperation_DoesNotWriteMisleadingAuditLog()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var service = new JobCardServiceApp(db, audit);

        var req = new CreateJobCardRequest
        {
            CustomerId = Guid.NewGuid(), // Non-existent customer
            VehicleId = Guid.NewGuid(),
            Services = new List<JobCardServiceItemRequest>()
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.CreateAsync(req));
        Assert.Empty(audit.RecordedLogs);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 2F-02: DECLARATIVE OWNER AUTHORIZATION REFLECTION & INTEGRITY TESTS
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public void InvoiceSeriesSettingsController_UpdatePrefixes_HasAuthorizeOwnerAttribute()
    {
        var method = typeof(InvoiceSeriesSettingsController).GetMethod(nameof(InvoiceSeriesSettingsController.UpdatePrefixes));
        Assert.NotNull(method);

        var attr = method!.GetCustomAttributes<AuthorizeAttribute>(true).FirstOrDefault();
        Assert.NotNull(attr);
        Assert.Equal("Owner", attr!.Roles);
    }

    [Fact]
    public void InvoicesController_UpdateInvoiceNumber_HasAuthorizeOwnerAttribute()
    {
        var method = typeof(InvoicesController).GetMethod(nameof(InvoicesController.UpdateInvoiceNumber));
        Assert.NotNull(method);

        var attr = method!.GetCustomAttributes<AuthorizeAttribute>(true).FirstOrDefault();
        Assert.NotNull(attr);
        Assert.Equal("Owner", attr!.Roles);
    }

    [Fact]
    public void ShowroomsController_UnlockAttendance_HasAuthorizeOwnerAttribute()
    {
        var method = typeof(ShowroomsController).GetMethod(nameof(ShowroomsController.UnlockAttendance));
        Assert.NotNull(method);

        var attr = method!.GetCustomAttributes<AuthorizeAttribute>(true).FirstOrDefault();
        Assert.NotNull(attr);
        Assert.Equal("Owner", attr!.Roles);
    }

    [Fact]
    public void StaffAttendanceController_UnlockAttendance_HasAuthorizeOwnerAttribute()
    {
        var method = typeof(StaffAttendanceController).GetMethod(nameof(StaffAttendanceController.UnlockAttendance));
        Assert.NotNull(method);

        var attr = method!.GetCustomAttributes<AuthorizeAttribute>(true).FirstOrDefault();
        Assert.NotNull(attr);
        Assert.Equal("Owner", attr!.Roles);
    }

    [Fact]
    public void UsersController_DoesNotHaveClassLevelAuthorizeOwner()
    {
        // Finding 2F-02 guardrail: UsersController must NOT be restricted to Owner only at class level,
        // because Managers legitimately administer Staff accounts.
        var classAttr = typeof(UsersController).GetCustomAttributes<AuthorizeAttribute>(true)
            .FirstOrDefault(a => a.Roles == "Owner");
        Assert.Null(classAttr);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 2F-03: STANDARDIZE DATABASE-BACKED OWNER VERIFICATION
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task ShowroomWorkTypes_Create_DeniesStaleOwnerJwtWhenDbUserIsStaff()
    {
        var db = CreateInMemoryDb();
        var opsService = new ShowroomOperationsService(db, new DummyAuditLogService());
        var controller = new ShowroomWorkTypesController(opsService, db);

        var callerId = Guid.NewGuid();
        // Database says Staff!
        var dbUser = new User { Id = callerId, Username = "demoted_user", FullName = "Demoted", Role = UserRole.Staff, IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(dbUser);
        await db.SaveChangesAsync();

        // JWT claims Owner!
        SetCaller(controller, callerId, "Owner", isOwner: true);

        var req = new CreateShowroomWorkTypeRequest { Name = "Stale Work Type", IsActive = true };
        var res = await controller.Create(req);

        var objRes = Assert.IsType<ObjectResult>(res);
        Assert.Equal(StatusCodes.Status403Forbidden, objRes.StatusCode);
    }

    [Fact]
    public async Task ShowroomWorkTypes_Create_DeniesStaleOwnerJwtWhenDbUserIsInactive()
    {
        var db = CreateInMemoryDb();
        var opsService = new ShowroomOperationsService(db, new DummyAuditLogService());
        var controller = new ShowroomWorkTypesController(opsService, db);

        var callerId = Guid.NewGuid();
        // Database says inactive Owner!
        var dbUser = new User { Id = callerId, Username = "inactive_owner", FullName = "Inactive Owner", Role = UserRole.Owner, IsActive = false, CreatedAt = DateTime.UtcNow };
        db.Users.Add(dbUser);
        await db.SaveChangesAsync();

        // JWT claims Owner!
        SetCaller(controller, callerId, "Owner", isOwner: true);

        var req = new CreateShowroomWorkTypeRequest { Name = "Inactive Owner Work Type", IsActive = true };
        var res = await controller.Create(req);

        var objRes = Assert.IsType<ObjectResult>(res);
        Assert.Equal(StatusCodes.Status403Forbidden, objRes.StatusCode);
    }

    [Fact]
    public async Task ShowroomWorkTypes_Create_AllowsGenuineActiveOwnerInDb()
    {
        var db = CreateInMemoryDb();
        var opsService = new ShowroomOperationsService(db, new DummyAuditLogService());
        var controller = new ShowroomWorkTypesController(opsService, db);

        var callerId = Guid.NewGuid();
        var dbUser = new User { Id = callerId, Username = "real_owner", FullName = "Real Owner", Role = UserRole.Owner, IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(dbUser);
        await db.SaveChangesAsync();

        SetCaller(controller, callerId, "Owner", isOwner: true);

        var req = new CreateShowroomWorkTypeRequest { Name = "Valid Owner Work Type", IsActive = true };
        var res = await controller.Create(req);

        var createdRes = Assert.IsType<CreatedAtActionResult>(res);
        Assert.Equal(StatusCodes.Status201Created, createdRes.StatusCode);
    }

    [Fact]
    public async Task ShowroomVehicleTypes_Create_DeniesStaleOwnerJwtWhenDbUserIsStaff()
    {
        var db = CreateInMemoryDb();
        var opsService = new ShowroomOperationsService(db, new DummyAuditLogService());
        var controller = new ShowroomVehicleTypesController(opsService, db);

        var callerId = Guid.NewGuid();
        var dbUser = new User { Id = callerId, Username = "demoted_vt", FullName = "Demoted VT", Role = UserRole.Staff, IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(dbUser);
        await db.SaveChangesAsync();

        SetCaller(controller, callerId, "Owner", isOwner: true);

        var req = new CreateShowroomVehicleTypeRequest { Name = "Stale Vehicle Type", IsActive = true };
        var res = await controller.Create(req);

        var objRes = Assert.IsType<ObjectResult>(res);
        Assert.Equal(StatusCodes.Status403Forbidden, objRes.StatusCode);
    }

    [Fact]
    public async Task ShowroomVehicleTypes_Create_DeniesStaleOwnerJwtWhenDbUserIsInactive()
    {
        var db = CreateInMemoryDb();
        var opsService = new ShowroomOperationsService(db, new DummyAuditLogService());
        var controller = new ShowroomVehicleTypesController(opsService, db);

        var callerId = Guid.NewGuid();
        var dbUser = new User { Id = callerId, Username = "inactive_vt", FullName = "Inactive VT", Role = UserRole.Owner, IsActive = false, CreatedAt = DateTime.UtcNow };
        db.Users.Add(dbUser);
        await db.SaveChangesAsync();

        SetCaller(controller, callerId, "Owner", isOwner: true);

        var req = new CreateShowroomVehicleTypeRequest { Name = "Inactive Vehicle Type", IsActive = true };
        var res = await controller.Create(req);

        var objRes = Assert.IsType<ObjectResult>(res);
        Assert.Equal(StatusCodes.Status403Forbidden, objRes.StatusCode);
    }

    [Fact]
    public async Task ShowroomVehicleTypes_Create_AllowsGenuineActiveOwnerInDb()
    {
        var db = CreateInMemoryDb();
        var opsService = new ShowroomOperationsService(db, new DummyAuditLogService());
        var controller = new ShowroomVehicleTypesController(opsService, db);

        var callerId = Guid.NewGuid();
        var dbUser = new User { Id = callerId, Username = "real_vt_owner", FullName = "Real VT Owner", Role = UserRole.Owner, IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(dbUser);
        await db.SaveChangesAsync();

        SetCaller(controller, callerId, "Owner", isOwner: true);

        var req = new CreateShowroomVehicleTypeRequest { Name = "Valid Vehicle Type", IsActive = true };
        var res = await controller.Create(req);

        var createdRes = Assert.IsType<CreatedAtActionResult>(res);
        Assert.Equal(StatusCodes.Status201Created, createdRes.StatusCode);
    }

    [Fact]
    public async Task ShowroomStaffAssignments_Update_DeniesStaleOwnerOnLockedRecord()
    {
        var db = CreateInMemoryDb();
        var service = new MockShowroomService();
        var controller = new ShowroomStaffAssignmentsController(service, db);

        var callerId = Guid.NewGuid();
        // Stale token: claims Owner in JWT, but database user is Staff!
        var dbUser = new User { Id = callerId, Username = "demoted_assignee", FullName = "Demoted", Role = UserRole.Staff, IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(dbUser);
        await db.SaveChangesAsync();

        SetCaller(controller, callerId, "Owner", isOwner: true);

        var res = await controller.Update(Guid.NewGuid(), new UpdateDailyStaffAssignmentRequest { VehiclesAttended = 5 }, CancellationToken.None);
        var objRes = Assert.IsType<ObjectResult>(res);
        Assert.Equal(StatusCodes.Status403Forbidden, objRes.StatusCode);
    }

    [Fact]
    public async Task ShowroomStaffAssignments_Update_AllowsGenuineOwnerOnLockedRecord()
    {
        var db = CreateInMemoryDb();
        var service = new MockShowroomService();
        var controller = new ShowroomStaffAssignmentsController(service, db);

        var callerId = Guid.NewGuid();
        var dbUser = new User { Id = callerId, Username = "genuine_owner_sr", FullName = "Owner", Role = UserRole.Owner, IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(dbUser);
        await db.SaveChangesAsync();

        SetCaller(controller, callerId, "Owner", isOwner: true);

        var res = await controller.Update(Guid.NewGuid(), new UpdateDailyStaffAssignmentRequest { VehiclesAttended = 5 }, CancellationToken.None);
        // Owner authorization passes; service returns null indicating assignment not found
        var notFoundRes = Assert.IsType<NotFoundObjectResult>(res);
        Assert.Equal(StatusCodes.Status404NotFound, notFoundRes.StatusCode);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 2F-05: NEGATIVE 403 TESTS & OWNER POSITIVE TESTS
    // ══════════════════════════════════════════════════════════════════════════

    // 1. Invoice Series Prefix Update
    [Fact]
    public async Task InvoiceSeriesPrefix_Manager_Returns403Forbidden()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var managerId = Guid.NewGuid();
        var managerUser = new User { Id = managerId, Username = "manager1", FullName = "Manager User", Role = UserRole.Manager, IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(managerUser);
        await db.SaveChangesAsync();

        var http = new DefaultHttpContext();
        http.User = CreatePrincipal(managerId, "Manager", isOwner: false);
        var httpAccessor = new HttpContextAccessor { HttpContext = http };

        var service = new InvoiceSeriesService(db, audit, httpAccessor);
        var controller = new InvoiceSeriesSettingsController(service);
        controller.ControllerContext = new ControllerContext { HttpContext = http };

        var res = await controller.UpdatePrefixes(new UpdateInvoiceSeriesRequest("GST-NEW", "BILL-NEW"), CancellationToken.None);
        var objRes = Assert.IsType<ObjectResult>(res);
        Assert.Equal(StatusCodes.Status403Forbidden, objRes.StatusCode);
    }

    [Fact]
    public async Task InvoiceSeriesPrefix_Owner_Succeeds()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var ownerId = Guid.NewGuid();
        var ownerUser = new User { Id = ownerId, Username = "owner1", FullName = "Owner User", Role = UserRole.Owner, IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(ownerUser);
        await db.SaveChangesAsync();

        var http = new DefaultHttpContext();
        http.User = CreatePrincipal(ownerId, "Owner", isOwner: true);
        var httpAccessor = new HttpContextAccessor { HttpContext = http };

        var service = new InvoiceSeriesService(db, audit, httpAccessor);
        var controller = new InvoiceSeriesSettingsController(service);
        controller.ControllerContext = new ControllerContext { HttpContext = http };

        var res = await controller.UpdatePrefixes(new UpdateInvoiceSeriesRequest("E6GST", "E6BILL"), CancellationToken.None);
        var okRes = Assert.IsType<OkObjectResult>(res);
        Assert.Equal(StatusCodes.Status200OK, okRes.StatusCode);
    }

    // 2. Invoice Number Override
    [Fact]
    public async Task InvoiceNumberOverride_Manager_Returns403Forbidden()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var managerId = Guid.NewGuid();
        var managerUser = new User { Id = managerId, Username = "manager_inv", FullName = "Manager Invoice", Role = UserRole.Manager, IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(managerUser);
        await db.SaveChangesAsync();

        var http = new DefaultHttpContext();
        http.User = CreatePrincipal(managerId, "Manager", isOwner: false);
        var httpAccessor = new HttpContextAccessor { HttpContext = http };

        var scopeFactory = new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();
        var invoiceService = new InvoiceService(db, audit, new ConfigurationBuilder().Build(), httpAccessor, new NoopWhatsAppService(), scopeFactory);
        var controller = new InvoicesController(invoiceService, new PassThroughAuthService(), new TestHostEnvironment());
        controller.ControllerContext = new ControllerContext { HttpContext = http };

        var res = await controller.UpdateInvoiceNumber(Guid.NewGuid(), new UpdateInvoiceNumberRequest("OVERRIDE-001"), CancellationToken.None);
        var objRes = Assert.IsType<ObjectResult>(res);
        Assert.Equal(StatusCodes.Status403Forbidden, objRes.StatusCode);
    }

    [Fact]
    public async Task InvoiceNumberOverride_Owner_ProceedsPastAuthorization()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var ownerId = Guid.NewGuid();
        var ownerUser = new User { Id = ownerId, Username = "owner_inv", FullName = "Owner Invoice", Role = UserRole.Owner, IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(ownerUser);
        await db.SaveChangesAsync();

        var http = new DefaultHttpContext();
        http.User = CreatePrincipal(ownerId, "Owner", isOwner: true);
        var httpAccessor = new HttpContextAccessor { HttpContext = http };

        var scopeFactory = new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();
        var invoiceService = new InvoiceService(db, audit, new ConfigurationBuilder().Build(), httpAccessor, new NoopWhatsAppService(), scopeFactory);
        var controller = new InvoicesController(invoiceService, new PassThroughAuthService(), new TestHostEnvironment());
        controller.ControllerContext = new ControllerContext { HttpContext = http };

        // For a non-existent invoice ID, the owner proceeds PAST the 403 Owner authorization check into business logic (returning 404 NotFound)
        var res = await controller.UpdateInvoiceNumber(Guid.NewGuid(), new UpdateInvoiceNumberRequest("OVERRIDE-001"), CancellationToken.None);
        var notFoundRes = Assert.IsType<NotFoundObjectResult>(res);
        Assert.Equal(StatusCodes.Status404NotFound, notFoundRes.StatusCode);
    }

    // 3. Showroom Attendance Unlock
    [Fact]
    public async Task ShowroomAttendanceUnlock_Manager_Returns403Forbidden()
    {
        var db = CreateInMemoryDb();
        var managerId = Guid.NewGuid();
        var managerUser = new User { Id = managerId, Username = "manager_sr", FullName = "Manager SR", Role = UserRole.Manager, IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(managerUser);
        await db.SaveChangesAsync();

        var controller = new ShowroomsController(new MockShowroomService(), db);
        SetCaller(controller, managerId, "Manager", isOwner: false);

        var res = await controller.UnlockAttendance(Guid.NewGuid(), "2026-10-07", null, CancellationToken.None);
        var objRes = Assert.IsType<ObjectResult>(res);
        Assert.Equal(StatusCodes.Status403Forbidden, objRes.StatusCode);
    }

    [Fact]
    public async Task ShowroomAttendanceUnlock_Owner_Succeeds()
    {
        var db = CreateInMemoryDb();
        var ownerId = Guid.NewGuid();
        var ownerUser = new User { Id = ownerId, Username = "owner_sr", FullName = "Owner SR", Role = UserRole.Owner, IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(ownerUser);
        await db.SaveChangesAsync();

        var controller = new ShowroomsController(new MockShowroomService(), db);
        SetCaller(controller, ownerId, "Owner", isOwner: true);

        var res = await controller.UnlockAttendance(Guid.NewGuid(), "2026-10-07", null, CancellationToken.None);
        var okRes = Assert.IsType<OkObjectResult>(res);
        Assert.Equal(StatusCodes.Status200OK, okRes.StatusCode);
    }

    // 4. Staff Attendance Unlock
    [Fact]
    public async Task StaffAttendanceUnlock_Manager_Returns403Forbidden()
    {
        var db = CreateInMemoryDb();
        var managerId = Guid.NewGuid();
        var managerUser = new User { Id = managerId, Username = "manager_staff", FullName = "Manager Staff", Role = UserRole.Manager, IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(managerUser);
        await db.SaveChangesAsync();

        var controller = new StaffAttendanceController(new MockStaffAttendanceService(), db);
        SetCaller(controller, managerId, "Manager", isOwner: false);

        var res = await controller.UnlockAttendance("2026-10-07", CancellationToken.None);
        var objRes = Assert.IsType<ObjectResult>(res);
        Assert.Equal(StatusCodes.Status403Forbidden, objRes.StatusCode);
    }

    [Fact]
    public async Task StaffAttendanceUnlock_Owner_Succeeds()
    {
        var db = CreateInMemoryDb();
        var ownerId = Guid.NewGuid();
        var ownerUser = new User { Id = ownerId, Username = "owner_staff", FullName = "Owner Staff", Role = UserRole.Owner, IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(ownerUser);
        await db.SaveChangesAsync();

        var controller = new StaffAttendanceController(new MockStaffAttendanceService(), db);
        SetCaller(controller, ownerId, "Owner", isOwner: true);

        var res = await controller.UnlockAttendance("2026-10-07", CancellationToken.None);
        var okRes = Assert.IsType<OkObjectResult>(res);
        Assert.Equal(StatusCodes.Status200OK, okRes.StatusCode);
    }

    // ── Helper Test Doubles ──────────────────────────────────────────────────

    private class MockShowroomService : IShowroomService
    {
        public Task<DailyStaffResponse> UnlockAttendanceAsync(Guid showroomId, DateTime date, Guid userId, bool isOwner, CancellationToken ct = default)
        {
            if (!isOwner)
            {
                throw new ForbiddenException("Only the Owner can unlock and correct attendance.");
            }

            return Task.FromResult(new DailyStaffResponse(
                showroomId,
                "Showroom 1",
                date,
                0,
                false,
                null,
                null,
                null,
                Array.Empty<DailyStaffAssignmentDto>()));
        }

        public Task<IReadOnlyList<ShowroomDto>> GetAllAsync(string? search = null, bool? isActive = null, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<ShowroomDto>>(Array.Empty<ShowroomDto>());
        public Task<ShowroomDto?> GetByIdAsync(Guid id, CancellationToken ct = default) => Task.FromResult<ShowroomDto?>(null);
        public Task<ShowroomDto> CreateAsync(CreateShowroomRequest request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<ShowroomDto?> UpdateAsync(Guid id, UpdateShowroomRequest request, CancellationToken ct = default) => Task.FromResult<ShowroomDto?>(null);
        public Task<bool> DeleteAsync(Guid id, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> ToggleActiveAsync(Guid id, CancellationToken ct = default) => Task.FromResult(true);
        public Task<DailyStaffResponse?> GetDailyStaffAsync(Guid showroomId, DateTime date, CancellationToken ct = default) => Task.FromResult<DailyStaffResponse?>(null);
        public Task<DailyStaffAssignmentDto> AssignStaffAsync(Guid showroomId, CreateDailyStaffAssignmentRequest request, bool isOwner = false, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<DailyStaffResponse> ConfirmAttendanceAsync(Guid showroomId, DateTime date, Guid userId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<DailyStaffAssignmentDto?> UpdateAssignmentAsync(Guid assignmentId, UpdateDailyStaffAssignmentRequest request, bool isOwner = false, CancellationToken ct = default)
        {
            if (!isOwner) throw new ForbiddenException("Cannot modify staff assignment for a locked date. Only an Owner can unlock or modify locked records.");
            return Task.FromResult<DailyStaffAssignmentDto?>(null);
        }
        public Task<DailyStaffAssignmentDto?> UpdateAssignmentVehiclesAsync(Guid assignmentId, int vehiclesAttended, bool isOwner = false, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<bool> RemoveAssignmentAsync(Guid assignmentId, bool isOwner = false, CancellationToken ct = default)
        {
            if (!isOwner) throw new ForbiddenException("Cannot remove staff assignment for a locked date. Only an Owner can unlock or remove locked records.");
            return Task.FromResult(true);
        }
        public Task<ShowroomDailyBillDto?> GetDailyBillAsync(Guid showroomId, DateTime date, CancellationToken ct = default) => Task.FromResult<ShowroomDailyBillDto?>(null);
        public Task<ShowroomDailyBillDto> SetDailyBillAsync(Guid showroomId, DateTime date, SetShowroomDailyBillRequest request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<ShowroomDailyBillDto> RecordPaymentAsync(Guid showroomId, DateTime date, RecordShowroomPaymentRequest request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<bool> DeletePaymentAsync(Guid paymentId, CancellationToken ct = default) => Task.FromResult(true);
        public Task<ShowroomSummaryDto?> GetShowroomSummaryAsync(Guid showroomId, DateTime fromDate, DateTime toDate, CancellationToken ct = default) => Task.FromResult<ShowroomSummaryDto?>(null);
        public Task<IReadOnlyList<ShowroomOutstandingOverviewDto>> GetOutstandingOverviewAsync(DateTime? fromDate = null, DateTime? toDate = null, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<ShowroomOutstandingOverviewDto>>(Array.Empty<ShowroomOutstandingOverviewDto>());
        public Task<ShowroomStaffSwapDto> SwapStaffAsync(CreateStaffSwapRequest request, Guid? userId = null, bool isOwner = false, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<ShowroomStaffSwapDto?> GetSwapByIdAsync(string swapId, CancellationToken ct = default) => Task.FromResult<ShowroomStaffSwapDto?>(null);
        public Task<IReadOnlyList<ShowroomStaffSwapDto>> GetSwapHistoryAsync(Guid? showroomId = null, Guid? staffId = null, DateTime? date = null, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<ShowroomStaffSwapDto>>(Array.Empty<ShowroomStaffSwapDto>());
        public Task<ShowroomStaffSwapDto> ReverseSwapAsync(string swapId, ReverseStaffSwapRequest? request = null, Guid? userId = null, bool isOwner = false, CancellationToken ct = default) => throw new NotImplementedException();
    }

    private class MockStaffAttendanceService : IStaffAttendanceService
    {
        public Task<DailyAttendanceResponse> UnlockAttendanceAsync(DateTime date, Guid userId, bool isOwner, CancellationToken ct = default)
        {
            if (!isOwner) throw new ForbiddenException("Only the Owner can unlock and correct attendance.");
            return Task.FromResult(new DailyAttendanceResponse(
                date.ToString("yyyy-MM-dd"),
                false,
                null,
                null,
                null,
                new DailyAttendanceSummaryDto(0, 0, 0, 0, 0),
                new List<DailyStaffAttendanceItemDto>()));
        }

        public Task<DailyAttendanceResponse> GetDailyAttendanceAsync(DateTime date, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<DateRangeAttendanceResponse> GetDateRangeAttendanceAsync(DateTime fromDate, DateTime toDate, Guid? staffId = null, string? status = null, string? search = null, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<MonthlyAttendanceReportResponse> GetMonthlyAttendanceReportAsync(int year, int month, Guid? staffId = null, string? status = null, string? search = null, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<StaffAttendanceDto> UpsertAttendanceAsync(UpsertStaffAttendanceRequest request, Guid userId, bool isOwner = false, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<bool> DeleteAttendanceAsync(Guid id, Guid userId, bool isOwner = false, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<DailyAttendanceResponse> ConfirmAttendanceAsync(DateTime date, Guid userId, CancellationToken ct = default) => throw new NotImplementedException();
    }

    private class PassThroughAuthService : IAuthorizationService
    {
        public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, IEnumerable<IAuthorizationRequirement> requirements) => Task.FromResult(AuthorizationResult.Success());
        public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, string policyName) => Task.FromResult(AuthorizationResult.Success());
    }

    private class TestHostEnvironment : Microsoft.AspNetCore.Hosting.IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Production";
        public string ApplicationName { get; set; } = "CarSpaManagement.Api";
        public string WebRootPath { get; set; } = "";
        public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; } = "";
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
    }
}
