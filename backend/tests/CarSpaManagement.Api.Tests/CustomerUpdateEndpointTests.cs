using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Customers;
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
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class CustomerUpdateEndpointTests
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
            throw new NotImplementedException();
        }
    }

    private static AppDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static (AppDbContext Db, IServiceScopeFactory ScopeFactory) CreateTestEnvironment()
    {
        var db = CreateInMemoryDb();
        var services = new ServiceCollection();
        services.AddScoped(_ => db);
        var provider = services.BuildServiceProvider();
        var scopeFactory = provider.GetRequiredService<IServiceScopeFactory>();
        return (db, scopeFactory);
    }

    private static ClaimsPrincipal CreatePrincipal(Guid userId, string role, bool isOwner, string[]? permissions = null)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new("sub", userId.ToString()),
            new(ClaimTypes.Name, "test_user"),
            new(ClaimTypes.Role, role),
            new("isOwner", isOwner ? "true" : "false")
        };

        if (permissions != null)
        {
            foreach (var perm in permissions)
            {
                claims.Add(new Claim("permissions", perm));
            }
        }

        return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
    }

    [Fact]
    public async Task UpdateCustomer_ValidRequest_ReturnsOkAndPersistsChanges()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var service = new CustomerService(db, audit);
        var controller = new CustomersController(service);

        var existing = new Customer
        {
            Id = Guid.NewGuid(),
            Name = "Original Name",
            PhoneNumber = "9876543210",
            Email = "original@example.com",
            Address = "Original Address",
            CreatedAt = DateTime.UtcNow
        };
        db.Customers.Add(existing);
        await db.SaveChangesAsync();

        var updateReq = new UpdateCustomerRequest
        {
            Name = "Updated Name",
            PhoneNumber = "9123456780",
            Email = "updated@example.com",
            Address = "Updated Address"
        };

        var result = await controller.Update(existing.Id, updateReq, CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<CustomerDto>(okResult.Value);
        Assert.Equal("Updated Name", dto.Name);
        Assert.Equal("9123456780", dto.PhoneNumber);
        Assert.Equal("updated@example.com", dto.Email);
        Assert.Equal("Updated Address", dto.Address);

        // Verify persistence in DB
        var persisted = await db.Customers.FindAsync(existing.Id);
        Assert.NotNull(persisted);
        Assert.Equal("Updated Name", persisted.Name);
        Assert.Equal("9123456780", persisted.PhoneNumber);
        Assert.Equal("updated@example.com", persisted.Email);
        Assert.Equal("Updated Address", persisted.Address);
        Assert.NotNull(persisted.UpdatedAt);
    }

    [Fact]
    public async Task UpdateCustomer_DuplicatePhoneNumber_ReturnsConflict()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var service = new CustomerService(db, audit);
        var controller = new CustomersController(service);

        var customerA = new Customer
        {
            Id = Guid.NewGuid(),
            Name = "Customer A",
            PhoneNumber = "9876543210",
            CreatedAt = DateTime.UtcNow
        };
        var customerB = new Customer
        {
            Id = Guid.NewGuid(),
            Name = "Customer B",
            PhoneNumber = "9123456789",
            CreatedAt = DateTime.UtcNow
        };
        db.Customers.AddRange(customerA, customerB);
        await db.SaveChangesAsync();

        // Customer A attempts to update phone to Customer B's phone
        var updateReq = new UpdateCustomerRequest
        {
            Name = "Customer A Updated",
            PhoneNumber = "9123456789" // already taken by Customer B
        };

        var result = await controller.Update(customerA.Id, updateReq, CancellationToken.None);

        var conflictResult = Assert.IsType<ConflictObjectResult>(result);
        Assert.NotNull(conflictResult.Value);
    }

    [Fact]
    public async Task UpdateCustomer_NonexistentCustomer_ReturnsNotFound()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var service = new CustomerService(db, audit);
        var controller = new CustomersController(service);

        var nonexistentId = Guid.NewGuid();
        var updateReq = new UpdateCustomerRequest
        {
            Name = "Nonexistent Customer",
            PhoneNumber = "9876543210"
        };

        var result = await controller.Update(nonexistentId, updateReq, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task UpdateCustomer_ModelValidationError_ReturnsValidationProblem()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var service = new CustomerService(db, audit);
        var controller = new CustomersController(service);
        controller.ModelState.AddModelError("PhoneNumber", "The PhoneNumber field is required.");

        var updateReq = new UpdateCustomerRequest
        {
            Name = "Some Name",
            PhoneNumber = ""
        };

        var result = await controller.Update(Guid.NewGuid(), updateReq, CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.IsAssignableFrom<ProblemDetails>(objectResult.Value);
    }

    [Fact]
    public void UpdateCustomer_HasRequirePermissionAttribute_ForCustomersEdit()
    {
        var method = typeof(CustomersController).GetMethod(nameof(CustomersController.Update));
        Assert.NotNull(method);

        var attr = (RequirePermissionAttribute?)Attribute.GetCustomAttribute(method, typeof(RequirePermissionAttribute));
        Assert.NotNull(attr);
        Assert.Equal("Permission:customers.edit", attr.Policy);
    }

    [Fact]
    public async Task PermissionHandler_ActiveStaff_WithCustomersEdit_Succeeds()
    {
        var (db, scopeFactory) = CreateTestEnvironment();
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var permission = new Permission
        {
            Id = Guid.NewGuid(),
            Code = "customers.edit",
            Name = "Edit Customers",
            Module = "Customers"
        };
        db.Permissions.Add(permission);

        var staff = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Staff Member",
            Username = "staff_editor",
            Role = UserRole.Staff,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        staff.UserPermissions.Add(new UserPermission
        {
            Id = Guid.NewGuid(),
            UserId = staff.Id,
            PermissionId = permission.Id
        });
        db.Users.Add(staff);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(staff.Id, role: "Staff", isOwner: false);
        var requirement = new PermissionRequirement("customers.edit");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task PermissionHandler_ActiveStaff_WithoutCustomersEdit_Fails()
    {
        var (db, scopeFactory) = CreateTestEnvironment();
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var staff = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Staff Member Without Permission",
            Username = "staff_viewer",
            Role = UserRole.Staff,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(staff);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(staff.Id, role: "Staff", isOwner: false);
        var requirement = new PermissionRequirement("customers.edit");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }

    [Fact]
    public async Task PermissionHandler_Owner_AlwaysSucceeds()
    {
        var (db, scopeFactory) = CreateTestEnvironment();
        var handler = new PermissionAuthorizationHandler(scopeFactory);

        var owner = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Owner",
            Username = "owner",
            Role = UserRole.Owner,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(owner);
        await db.SaveChangesAsync();

        var principal = CreatePrincipal(owner.Id, role: "Owner", isOwner: true);
        var requirement = new PermissionRequirement("customers.edit");
        var context = new AuthorizationHandlerContext(new[] { requirement }, principal, null);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public async Task GetByIdAsync_ReturnsAuthoritativeVehicleCount(int vehicleCount)
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var service = new CustomerService(db, audit);

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = $"Customer with {vehicleCount} vehicles",
            PhoneNumber = $"98765432{vehicleCount:D2}",
            CreatedAt = DateTime.UtcNow
        };
        db.Customers.Add(customer);

        for (int i = 0; i < vehicleCount; i++)
        {
            db.Vehicles.Add(new Vehicle
            {
                Id = Guid.NewGuid(),
                RegistrationNumber = $"TN33AB000{i + 1}",
                Make = "Tata",
                Model = "Nexon",
                CustomerId = customer.Id,
                IsDeleted = false
            });
        }
        await db.SaveChangesAsync();

        var dto = await service.GetByIdAsync(customer.Id);

        Assert.NotNull(dto);
        Assert.Equal(vehicleCount, dto.VehicleCount);
        Assert.Equal(vehicleCount, dto.VehicleRegistrationNumbers?.Count ?? 0);
    }

    [Fact]
    public async Task UpdateAsync_ReturnsActualVehicleCount_NotHardcodedZero()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var service = new CustomerService(db, audit);

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = "Krishna",
            PhoneNumber = "9874563210",
            CreatedAt = DateTime.UtcNow
        };
        db.Customers.Add(customer);

        // Add 2 vehicles for Krishna
        db.Vehicles.Add(new Vehicle
        {
            Id = Guid.NewGuid(),
            RegistrationNumber = "TN33A0001",
            Make = "Tata",
            Model = "Nexon",
            CustomerId = customer.Id,
            IsDeleted = false
        });
        db.Vehicles.Add(new Vehicle
        {
            Id = Guid.NewGuid(),
            RegistrationNumber = "TN33A0002",
            Make = "Tata",
            Model = "Mazza",
            CustomerId = customer.Id,
            IsDeleted = false
        });
        await db.SaveChangesAsync();

        var updateReq = new UpdateCustomerRequest
        {
            Name = "Krishna Updated",
            PhoneNumber = "9874563210",
            Email = "krishna@example.com",
            Address = "Erode"
        };

        var updated = await service.UpdateAsync(customer.Id, updateReq);

        Assert.NotNull(updated);
        Assert.Equal("Krishna Updated", updated.Name);
        Assert.Equal(2, updated.VehicleCount);
        Assert.Equal(2, updated.VehicleRegistrationNumbers?.Count);
        Assert.Contains("TN33A0001", updated.VehicleRegistrationNumbers!);
        Assert.Contains("TN33A0002", updated.VehicleRegistrationNumbers!);
    }

    [Fact]
    public async Task OwnershipTransfer_UpdatesBothCustomerVehicleCounts()
    {
        var db = CreateInMemoryDb();
        var audit = new DummyAuditLogService();
        var custService = new CustomerService(db, audit);
        var vehService = new VehicleService(db, audit);

        var custA = new Customer { Id = Guid.NewGuid(), Name = "Customer A", PhoneNumber = "9876543201" };
        var custB = new Customer { Id = Guid.NewGuid(), Name = "Customer B", PhoneNumber = "9876543202" };
        db.Customers.AddRange(custA, custB);

        var veh = new Vehicle
        {
            Id = Guid.NewGuid(),
            RegistrationNumber = "TN33TRANSFER",
            Make = "Hyundai",
            Model = "Creta",
            CustomerId = custA.Id,
            IsDeleted = false
        };
        db.Vehicles.Add(veh);
        await db.SaveChangesAsync();

        // Initially: A has 1, B has 0
        var dtoA = await custService.GetByIdAsync(custA.Id);
        var dtoB = await custService.GetByIdAsync(custB.Id);
        Assert.Equal(1, dtoA!.VehicleCount);
        Assert.Equal(0, dtoB!.VehicleCount);

        // Transfer to Customer B
        await vehService.TransferOwnershipAsync(veh.Id, custB.Id);

        // After transfer: A has 0, B has 1
        var dtoAAfter = await custService.GetByIdAsync(custA.Id);
        var dtoBAfter = await custService.GetByIdAsync(custB.Id);
        Assert.Equal(0, dtoAAfter!.VehicleCount);
        Assert.Equal(1, dtoBAfter!.VehicleCount);
    }
}

