using System.Security.Claims;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Customers;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.DTOs.Services;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.DTOs.StaffAdvances;
using CarSpaManagement.Api.Application.DTOs.Vehicles;
using CarSpaManagement.Api.Application.DTOs.WhatsApp;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class AuditTrailSecurityTests
{
    private static AppDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static (AppDbContext Db, IHttpContextAccessor HttpContextAccessor, AuditLogService AuditService) CreateAuditContext(Guid? userId = null, string? username = null, string? role = null)
    {
        var db = CreateInMemoryDb();
        var httpContextAccessor = new HttpContextAccessor();

        if (userId.HasValue || !string.IsNullOrEmpty(username))
        {
            var claims = new List<Claim>();
            if (userId.HasValue)
            {
                claims.Add(new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString()));
                claims.Add(new Claim("sub", userId.Value.ToString()));
            }
            if (!string.IsNullOrEmpty(username))
            {
                claims.Add(new Claim(ClaimTypes.Name, username));
            }
            if (!string.IsNullOrEmpty(role))
            {
                claims.Add(new Claim(ClaimTypes.Role, role));
                claims.Add(new Claim("role", role));
            }

            var identity = new ClaimsIdentity(claims, "TestAuth");
            httpContextAccessor.HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(identity)
            };
            httpContextAccessor.HttpContext.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("127.0.0.1");
        }

        var auditService = new AuditLogService(db, httpContextAccessor);
        return (db, httpContextAccessor, auditService);
    }

    // ── 1. Audit Record Creation & Actor Resolution ─────────────────────────

    [Fact]
    public async Task AuditLogService_RecordAsync_CreatesAuditRecordWithActorIdentityFromClaims()
    {
        var actorId = Guid.NewGuid();
        var (db, _, auditService) = CreateAuditContext(actorId, "admin_user", "Owner");

        await auditService.RecordAsync(
            action: "test.action",
            module: "Testing",
            description: "Test description",
            cancellationToken: CancellationToken.None);

        var log = await db.AuditLogs.FirstOrDefaultAsync();
        Assert.NotNull(log);
        Assert.Equal("test.action", log.Action);
        Assert.Equal("Testing", log.Module);
        Assert.Equal(actorId, log.UserId);
        Assert.Equal("admin_user", log.UserName);
        Assert.Equal("Owner", log.UserRole);
        Assert.Equal("127.0.0.1", log.IpAddress);
        Assert.Equal("Success", log.Outcome);
    }

    // ── 2. Sensitive Data Redaction in Audit Logs ────────────────────────────

    [Fact]
    public async Task AuditLogService_SanitizesSensitiveJsonFields()
    {
        var (db, _, auditService) = CreateAuditContext();

        var sensitiveJson = "{\"username\":\"john\",\"password\":\"SecretPassword123\",\"token\":\"jwt.token.here\",\"apiKey\":\"secret_api_key\"}";

        await auditService.RecordAsync(
            action: "auth.login",
            module: "Auth",
            description: "Login attempted with password: SecretPassword123",
            newValues: sensitiveJson,
            metadata: sensitiveJson,
            cancellationToken: CancellationToken.None);

        var log = await db.AuditLogs.FirstOrDefaultAsync();
        Assert.NotNull(log);

        Assert.DoesNotContain("SecretPassword123", log.NewValues);
        Assert.DoesNotContain("jwt.token.here", log.NewValues);
        Assert.DoesNotContain("secret_api_key", log.NewValues);
        Assert.Contains("[REDACTED]", log.NewValues);

        Assert.DoesNotContain("SecretPassword123", log.Description);
        Assert.Contains("password=[REDACTED]", log.Description);
    }

    // ── 3. Customer Lifecycle Auditing ──────────────────────────────────────

    [Fact]
    public async Task CustomerService_Create_Edit_Delete_AreAudited()
    {
        var (db, _, auditService) = CreateAuditContext(Guid.NewGuid(), "manager_bob", "Manager");
        var customerService = new CustomerService(db, auditService);

        // 1. Create
        var created = await customerService.CreateAsync(new CreateCustomerRequest
        {
            Name = "Alice Smith",
            PhoneNumber = "9876543210"
        });

        var createLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.Action == "customers.create");
        Assert.NotNull(createLog);
        Assert.Equal("Customers", createLog.Module);
        Assert.Equal(created.Id, createLog.EntityId);
        Assert.Contains("Alice Smith", createLog.Description);

        // 2. Edit
        await customerService.UpdateAsync(created.Id, new UpdateCustomerRequest
        {
            Name = "Alice Johnson",
            PhoneNumber = "9876543210"
        });

        var editLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.Action == "customers.edit");
        Assert.NotNull(editLog);
        Assert.Contains("Alice Johnson", editLog.Description);

        // 3. Delete
        await customerService.DeleteAsync(created.Id);
        var deleteLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.Action == "customers.delete");
        Assert.NotNull(deleteLog);
        Assert.Equal(created.Id, deleteLog.EntityId);
    }

    // ── 4. Vehicle Lifecycle Auditing ───────────────────────────────────────

    [Fact]
    public async Task VehicleService_Create_Edit_Delete_AreAudited()
    {
        var (db, _, auditService) = CreateAuditContext(Guid.NewGuid(), "staff_clerk", "Staff");
        var vehicleService = new VehicleService(db, auditService);

        var customer = new Customer { Id = Guid.NewGuid(), Name = "Bob", PhoneNumber = "9998887776" };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        // 1. Create
        var created = await vehicleService.CreateAsync(new CreateVehicleRequest
        {
            RegistrationNumber = "TN01AA1111",
            Make = "Hyundai",
            Model = "Creta",
            CustomerId = customer.Id
        });

        var createLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.Action == "vehicles.create");
        Assert.NotNull(createLog);
        Assert.Equal(created.Id, createLog.EntityId);
        Assert.Contains("TN01AA1111", createLog.Description);

        // 2. Edit
        await vehicleService.UpdateAsync(created.Id, new UpdateVehicleRequest
        {
            RegistrationNumber = "TN01AA1111",
            Make = "Hyundai",
            Model = "Creta SX"
        });

        var editLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.Action == "vehicles.edit");
        Assert.NotNull(editLog);

        // 3. Delete
        await vehicleService.DeleteAsync(created.Id);
        var deleteLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.Action == "vehicles.delete");
        Assert.NotNull(deleteLog);
        Assert.Equal(created.Id, deleteLog.EntityId);
    }

    // ── 5. Catalogue Service Lifecycle Auditing ─────────────────────────────

    [Fact]
    public async Task ServiceService_Create_Edit_Delete_AreAudited()
    {
        var (db, _, auditService) = CreateAuditContext(Guid.NewGuid(), "owner_admin", "Owner");
        var serviceService = new ServiceService(db, auditService);

        // 1. Create
        var created = await serviceService.CreateAsync(new CreateServiceRequest
        {
            Name = "Ceramic Coating",
            Price = 15000,
            TaxPercentage = 18,
            IsActive = true
        });

        var createLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.Action == "catalogue.create");
        Assert.NotNull(createLog);
        Assert.Equal(created.Id, createLog.EntityId);

        // 2. Edit (Price change)
        await serviceService.UpdateAsync(created.Id, new UpdateServiceRequest
        {
            Name = "Ceramic Coating Pro",
            Price = 18000,
            TaxPercentage = 18,
            IsActive = true
        });

        var editLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.Action == "catalogue.edit");
        Assert.NotNull(editLog);
        Assert.Contains("15000", editLog.Description);
        Assert.Contains("18000", editLog.Description);

        // 3. Delete
        await serviceService.DeleteAsync(created.Id);
        var deleteLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.Action == "catalogue.delete");
        Assert.NotNull(deleteLog);
        Assert.Equal(created.Id, deleteLog.EntityId);
    }

    // ── 6. Job Card Lifecycle Auditing ──────────────────────────────────────

    [Fact]
    public async Task JobCardService_Create_Edit_Delete_AreAudited()
    {
        var (db, _, auditService) = CreateAuditContext(Guid.NewGuid(), "manager_dan", "Manager");
        var jobCardService = new CarSpaManagement.Api.Application.Services.JobCardService(db, auditService);

        var customer = new Customer { Id = Guid.NewGuid(), Name = "Charlie", PhoneNumber = "9988776655" };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), RegistrationNumber = "TN02BB2222", CustomerId = customer.Id };
        var service = new Service { Id = Guid.NewGuid(), Name = "Wash", Price = 500, TaxPercentage = 18, IsActive = true };

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.Services.Add(service);
        await db.SaveChangesAsync();

        // 1. Create
        var created = await jobCardService.CreateAsync(new CreateJobCardRequest
        {
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = service.Id, Quantity = 1, DiscountAmount = 0 }
            }
        });

        var createLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.Action == "jobcards.create");
        Assert.NotNull(createLog);
        Assert.Equal(created.Id, createLog.EntityId);

        // 2. Edit Services
        await jobCardService.UpdateServicesAsync(created.Id, new UpdateJobCardServicesRequest
        {
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = service.Id, Quantity = 2, DiscountAmount = 50 }
            }
        });

        var editLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.Action == "jobcards.edit");
        Assert.NotNull(editLog);

        // 3. Delete
        await jobCardService.DeleteAsync(created.Id);
        var deleteLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.Action == "jobcards.delete");
        Assert.NotNull(deleteLog);
        Assert.Equal(created.Id, deleteLog.EntityId);
    }

    // ── 7. Staff & Showroom Deletions Auditing ───────────────────────────────

    [Fact]
    public async Task StaffAdvanceService_DeleteStaff_IsAudited()
    {
        var (db, _, auditService) = CreateAuditContext(Guid.NewGuid(), "owner_admin", "Owner");
        var staffService = new StaffAdvanceService(db, auditService);

        var staff = new Staff { Id = Guid.NewGuid(), Name = "Worker Raj", PhoneNumber = "9876540000", Role = "Detailer" };
        db.Staff.Add(staff);
        await db.SaveChangesAsync();

        await staffService.DeleteStaffMemberAsync(staff.Id);

        var log = await db.AuditLogs.FirstOrDefaultAsync(l => l.Action == "staff.delete");
        Assert.NotNull(log);
        Assert.Equal(staff.Id, log.EntityId);
        Assert.Contains("Worker Raj", log.Description);
    }

    [Fact]
    public async Task ShowroomService_RecordPayment_DeletePayment_AreAudited()
    {
        var (db, _, auditService) = CreateAuditContext(Guid.NewGuid(), "owner_admin", "Owner");
        var showroomService = new ShowroomService(db, auditService);

        var showroom = new Showroom { Id = Guid.NewGuid(), Name = "Downtown Motors", Address = "City Center", IsActive = true };
        db.Showrooms.Add(showroom);
        await db.SaveChangesAsync();

        var bill = await showroomService.SetDailyBillAsync(showroom.Id, DateTime.UtcNow, new SetShowroomDailyBillRequest { Amount = 10000 });

        // Record Payment
        var updatedBill = await showroomService.RecordPaymentAsync(showroom.Id, DateTime.UtcNow, new RecordShowroomPaymentRequest
        {
            Amount = 5000,
            PaymentMethod = "UPI"
        });

        var recordLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.Action == "showroom.record_payment");
        Assert.NotNull(recordLog);
        Assert.Contains("5000", recordLog.Description);

        // Delete Payment
        var paymentId = updatedBill.Payments.First().Id;
        await showroomService.DeletePaymentAsync(paymentId);

        var deleteLog = await db.AuditLogs.FirstOrDefaultAsync(l => l.Action == "showroom.delete_payment");
        Assert.NotNull(deleteLog);
        Assert.Equal(paymentId, deleteLog.EntityId);
    }

    // ── 8. Audit Controller Authorization & Tamper Protection ───────────────

    [Fact]
    public void AuditLogsController_RequiresAuditViewPermission()
    {
        var method = typeof(AuditLogsController).GetMethod(nameof(AuditLogsController.GetLogs));
        Assert.NotNull(method);

        var requirePermAttr = method!.GetCustomAttributes(typeof(RequirePermissionAttribute), inherit: true)
            .Cast<RequirePermissionAttribute>()
            .FirstOrDefault();

        Assert.NotNull(requirePermAttr);
        Assert.Equal("Permission:audit.view", requirePermAttr!.Policy);
    }

    [Fact]
    public void AuditLogsController_HasClassLevelAuthorizeAttribute()
    {
        var attributes = typeof(AuditLogsController).GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true);
        Assert.NotEmpty(attributes);
    }

    [Fact]
    public void AuditLogsController_DoesNotExposeModifyingEndpoints()
    {
        // Assert there are NO HttpPost, HttpPut, HttpPatch, or HttpDelete endpoints on AuditLogsController
        var postMethods = typeof(AuditLogsController).GetMethods().Where(m => m.GetCustomAttributes(typeof(HttpPostAttribute), inherit: true).Any());
        var putMethods = typeof(AuditLogsController).GetMethods().Where(m => m.GetCustomAttributes(typeof(HttpPutAttribute), inherit: true).Any());
        var patchMethods = typeof(AuditLogsController).GetMethods().Where(m => m.GetCustomAttributes(typeof(HttpPatchAttribute), inherit: true).Any());
        var deleteMethods = typeof(AuditLogsController).GetMethods().Where(m => m.GetCustomAttributes(typeof(HttpDeleteAttribute), inherit: true).Any());

        Assert.Empty(postMethods);
        Assert.Empty(putMethods);
        Assert.Empty(patchMethods);
        Assert.Empty(deleteMethods);
    }

    [Fact]
    public async Task AuditLogsController_GetLogs_ReturnsPagedResult()
    {
        var (db, _, auditService) = CreateAuditContext(Guid.NewGuid(), "admin", "Owner");
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "test.action",
            Module = "Test",
            Description = "Audit log 1",
            TimestampUtc = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = new AuditLogsController(auditService);
        var result = await controller.GetLogs(new AuditLogQueryParameters { Page = 1, PageSize = 10 }, CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var pagedResult = Assert.IsType<PagedResult<AuditLogDto>>(okResult.Value);
        Assert.Single(pagedResult.Items);
        Assert.Equal("test.action", pagedResult.Items[0].Action);
    }
}
