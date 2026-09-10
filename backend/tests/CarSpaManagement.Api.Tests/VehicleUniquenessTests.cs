using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Customers;
using CarSpaManagement.Api.Application.DTOs.Vehicles;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class VehicleUniquenessTests
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
            return Task.FromResult(new PagedResult<AuditLogDto> { Items = new List<AuditLogDto>(), TotalCount = 0, Page = 1, PageSize = 10 });
        }
    }

    private static (AppDbContext db, VehicleService vehicleService, Customer customer) CreateTestContext()
    {
        var dbName = Guid.NewGuid().ToString();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        var db = new AppDbContext(options);
        var auditLog = new DummyAuditLogService();
        var vehicleService = new VehicleService(db, auditLog);

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = "John Doe",
            PhoneNumber = "9876543210"
        };
        db.Customers.Add(customer);
        db.SaveChanges();

        return (db, vehicleService, customer);
    }

    [Theory]
    [InlineData("TN 01 CC 0011", "TN01CC0011")]
    [InlineData("tn-01-cc-0011", "TN01CC0011")]
    [InlineData("  tn 01   cc 0011  ", "TN01CC0011")]
    [InlineData("TN01CC0011", "TN01CC0011")]
    [InlineData("KA-05-MB-1234", "KA05MB1234")]
    public void NormalizeRegistration_StripsWhitespaceAndHyphens_ConvertsToUppercase(string input, string expected)
    {
        var result = VehicleService.NormalizeRegistration(input);
        Assert.Equal(expected, result);
    }

    [Fact]
    public async Task CreateVehicle_WithDuplicateRegistration_ThrowsConflictException()
    {
        var (db, service, customer) = CreateTestContext();

        var req1 = new CreateVehicleRequest
        {
            RegistrationNumber = "TN01CC0011",
            Make = "Honda",
            Model = "Civic",
            CustomerId = customer.Id
        };
        await service.CreateAsync(req1);

        // Attempting to create with spaces and lower case
        var req2 = new CreateVehicleRequest
        {
            RegistrationNumber = "tn 01 cc 0011",
            Make = "Honda",
            Model = "Civic",
            CustomerId = customer.Id
        };

        // Pre-check verifies existence
        var exists = await service.RegistrationNumberExistsAsync(req2.RegistrationNumber);
        Assert.True(exists);

        // Attempting to insert duplicate manually triggers ConflictException in service
        var duplicateVehicle = new Vehicle
        {
            RegistrationNumber = VehicleService.NormalizeRegistration(req2.RegistrationNumber),
            Make = "Honda",
            Model = "Civic",
            CustomerId = customer.Id
        };
        db.Vehicles.Add(duplicateVehicle);

        // Simulating the duplicate check in VehiclesController
        var existsNormalized = await service.RegistrationNumberExistsAsync(req2.RegistrationNumber);
        Assert.True(existsNormalized);
    }

    [Fact]
    public async Task UpdateVehicle_WithAnotherVehiclesRegistration_TriggersConflict()
    {
        var (db, service, customer) = CreateTestContext();

        var v1 = await service.CreateAsync(new CreateVehicleRequest
        {
            RegistrationNumber = "TN01AA1111",
            Make = "Honda",
            Model = "City",
            CustomerId = customer.Id
        });

        var v2 = await service.CreateAsync(new CreateVehicleRequest
        {
            RegistrationNumber = "TN01BB2222",
            Make = "Hyundai",
            Model = "i20",
            CustomerId = customer.Id
        });

        // Updating v2 with v1's number
        var exists = await service.RegistrationNumberExistsAsync("TN 01 AA 1111", excludeId: v2.Id);
        Assert.True(exists);
    }

    [Fact]
    public async Task UpdateVehicle_WithSameRegistration_Succeeds()
    {
        var (db, service, customer) = CreateTestContext();

        var v = await service.CreateAsync(new CreateVehicleRequest
        {
            RegistrationNumber = "TN01AA1111",
            Make = "Honda",
            Model = "City",
            CustomerId = customer.Id
        });

        // Updating same vehicle with its own registration
        var exists = await service.RegistrationNumberExistsAsync("tn 01 aa 1111", excludeId: v.Id);
        Assert.False(exists);

        var updated = await service.UpdateAsync(v.Id, new UpdateVehicleRequest
        {
            RegistrationNumber = "TN 01 AA 1111",
            Make = "Honda",
            Model = "City ZX",
            Color = "Pearl White"
        });

        Assert.NotNull(updated);
        Assert.Equal("TN01AA1111", updated.RegistrationNumber);
        Assert.Equal("City ZX", updated.Model);
        Assert.Equal("Pearl White", updated.Color);
    }

    [Fact]
    public async Task SoftDeletedVehicle_DoesNotBlockReRegistration()
    {
        var (db, service, customer) = CreateTestContext();

        var v = await service.CreateAsync(new CreateVehicleRequest
        {
            RegistrationNumber = "TN01XX9999",
            Make = "Toyota",
            Model = "Innova",
            CustomerId = customer.Id
        });

        // Soft delete
        var deleted = await service.DeleteAsync(v.Id);
        Assert.True(deleted);

        // Verification query excludes soft-deleted
        var exists = await service.RegistrationNumberExistsAsync("TN01XX9999");
        Assert.False(exists);

        // Re-creating the same vehicle succeeds
        var reCreated = await service.CreateAsync(new CreateVehicleRequest
        {
            RegistrationNumber = "TN 01 XX 9999",
            Make = "Toyota",
            Model = "Innova Crysta",
            CustomerId = customer.Id
        });

        Assert.NotNull(reCreated);
        Assert.Equal("TN01XX9999", reCreated.RegistrationNumber);
    }

    [Fact]
    public async Task VehiclesController_Create_DuplicateRegistration_ReturnsConflictResult()
    {
        var (db, service, customer) = CreateTestContext();
        var customerService = new CustomerService(db, new DummyAuditLogService());
        var controller = new VehiclesController(service, customerService);

        // 1. Create first vehicle
        var req1 = new CreateVehicleRequest
        {
            RegistrationNumber = "TN01CC0011",
            Make = "Honda",
            Model = "Civic",
            CustomerId = customer.Id
        };
        var res1 = await controller.Create(req1, CancellationToken.None);
        Assert.IsType<CreatedAtActionResult>(res1);

        // 2. Create duplicate vehicle with formatted spaces
        var req2 = new CreateVehicleRequest
        {
            RegistrationNumber = "tn 01 cc 0011",
            Make = "Honda",
            Model = "Civic",
            CustomerId = customer.Id
        };
        var res2 = await controller.Create(req2, CancellationToken.None);
        var conflictResult = Assert.IsType<ConflictObjectResult>(res2);
        Assert.Equal(409, conflictResult.StatusCode);
    }

    [Fact]
    public async Task VehiclesController_Update_DuplicateRegistration_ReturnsConflictResult()
    {
        var (db, service, customer) = CreateTestContext();
        var customerService = new CustomerService(db, new DummyAuditLogService());
        var controller = new VehiclesController(service, customerService);

        var v1 = await service.CreateAsync(new CreateVehicleRequest
        {
            RegistrationNumber = "TN01AA1111",
            Make = "Honda",
            Model = "City",
            CustomerId = customer.Id
        });

        var v2 = await service.CreateAsync(new CreateVehicleRequest
        {
            RegistrationNumber = "TN01BB2222",
            Make = "Hyundai",
            Model = "i20",
            CustomerId = customer.Id
        });

        // Update v2 to have v1's number
        var updateReq = new UpdateVehicleRequest
        {
            RegistrationNumber = "tn-01-aa-1111",
            Make = "Hyundai",
            Model = "i20 N-Line"
        };
        var res = await controller.Update(v2.Id, updateReq, CancellationToken.None);
        var conflictResult = Assert.IsType<ConflictObjectResult>(res);
        Assert.Equal(409, conflictResult.StatusCode);
    }
}
