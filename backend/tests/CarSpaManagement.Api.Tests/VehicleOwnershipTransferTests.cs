using System.Reflection;
using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Customers;
using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.DTOs.Vehicles;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class VehicleOwnershipTransferTests
{
    private class RecordingAuditLogService : IAuditLogService
    {
        public List<(string action, string module, string description, Guid? entityId, string? oldValues, string? newValues)> RecordedEntries { get; } = new();

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
            RecordedEntries.Add((action, module, description, entityId, oldValues, newValues));
            return Task.CompletedTask;
        }

        public Task<PagedResult<AuditLogDto>> GetLogsAsync(
            AuditLogQueryParameters query,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new PagedResult<AuditLogDto> { Items = new List<AuditLogDto>(), TotalCount = 0, Page = 1, PageSize = 10 });
        }
    }

    private static (AppDbContext db, VehicleService vehicleService, RecordingAuditLogService auditLog, Customer customerA, Customer customerB, Vehicle vehicle) CreateTestContext()
    {
        var dbName = Guid.NewGuid().ToString();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        var db = new AppDbContext(options);
        var auditLog = new RecordingAuditLogService();
        var vehicleService = new VehicleService(db, auditLog);

        var customerA = new Customer
        {
            Id = Guid.NewGuid(),
            Name = "Person A",
            PhoneNumber = "9876543210"
        };
        var customerB = new Customer
        {
            Id = Guid.NewGuid(),
            Name = "Person B",
            PhoneNumber = "9123456780"
        };
        db.Customers.AddRange(customerA, customerB);

        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid(),
            RegistrationNumber = "TN56P3334",
            Make = "Maruti",
            Model = "Baleno",
            Variant = "Alpha",
            Color = "Nexa Blue",
            CustomerId = customerA.Id
        };
        db.Vehicles.Add(vehicle);
        db.SaveChanges();

        return (db, vehicleService, auditLog, customerA, customerB, vehicle);
    }

    [Fact]
    public async Task TransferOwnership_Success_UpdatesCustomerId_And_PreservesVehicleIdAndRegistration()
    {
        var (db, service, auditLog, customerA, customerB, vehicle) = CreateTestContext();
        var originalVehicleId = vehicle.Id;
        var originalRegistration = vehicle.RegistrationNumber;

        var result = await service.TransferOwnershipAsync(vehicle.Id, customerB.Id);

        Assert.NotNull(result);
        Assert.Equal(originalVehicleId, result.Id);
        Assert.Equal(originalRegistration, result.RegistrationNumber);
        Assert.Equal(customerB.Id, result.CustomerId);
        Assert.Equal("Person B", result.CustomerName);

        // Verify database state
        var dbVehicle = await db.Vehicles.FindAsync(originalVehicleId);
        Assert.NotNull(dbVehicle);
        Assert.Equal(customerB.Id, dbVehicle.CustomerId);
        Assert.Equal(originalRegistration, dbVehicle.RegistrationNumber);

        // Verify audit log
        Assert.Single(auditLog.RecordedEntries);
        var entry = auditLog.RecordedEntries.First();
        Assert.Equal("vehicles.transfer_ownership", entry.action);
        Assert.Equal("Vehicles", entry.module);
        Assert.Equal(originalVehicleId, entry.entityId);
        Assert.Contains("Person A", entry.description);
        Assert.Contains("Person B", entry.description);
        Assert.Contains("TN56P3334", entry.description);
    }

    [Fact]
    public async Task TransferOwnership_HistoricalIntegrity_PreservesJobCardsInvoicesAndPayments()
    {
        var (db, service, auditLog, customerA, customerB, vehicle) = CreateTestContext();

        // 1. Seed historical Job Card under Customer A
        var historicalJobCard = new JobCard
        {
            Id = Guid.NewGuid(),
            JobCardNumber = "JC-2026-000010",
            CustomerId = customerA.Id,
            VehicleId = vehicle.Id,
            Status = JobCardStatus.Invoiced,
            Subtotal = 1000m,
            TaxAmount = 180m,
            TotalAmount = 1180m
        };
        db.JobCards.Add(historicalJobCard);

        // 2. Seed historical Invoice under Customer A
        var historicalInvoice = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-2026-000005",
            JobCardId = historicalJobCard.Id,
            CustomerId = customerA.Id,
            VehicleId = vehicle.Id,
            Subtotal = 1000m,
            TaxableAmount = 1000m,
            GstAmount = 180m,
            TotalAmount = 1180m,
            PaidAmount = 1180m,
            BalanceAmount = 0m,
            Status = InvoiceStatus.Paid
        };
        db.Invoices.Add(historicalInvoice);

        // 3. Seed Payment under historical Invoice
        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            InvoiceId = historicalInvoice.Id,
            Amount = 1180m,
            PaymentMethod = PaymentMethod.UPI,
            PaymentDate = DateTime.UtcNow
        };
        db.Payments.Add(payment);
        await db.SaveChangesAsync();

        // 4. Perform vehicle ownership transfer
        await service.TransferOwnershipAsync(vehicle.Id, customerB.Id);

        // 5. Verify historical integrity:
        // JobCard CustomerId must remain Customer A
        var reloadedJc = await db.JobCards.FindAsync(historicalJobCard.Id);
        Assert.NotNull(reloadedJc);
        Assert.Equal(customerA.Id, reloadedJc.CustomerId);
        Assert.Equal(vehicle.Id, reloadedJc.VehicleId);

        // Invoice CustomerId and VehicleId must remain Customer A and Vehicle
        var reloadedInv = await db.Invoices.FindAsync(historicalInvoice.Id);
        Assert.NotNull(reloadedInv);
        Assert.Equal(customerA.Id, reloadedInv.CustomerId);
        Assert.Equal(vehicle.Id, reloadedInv.VehicleId);

        // Payment must remain attached to Invoice
        var reloadedPayment = await db.Payments.FindAsync(payment.Id);
        Assert.NotNull(reloadedPayment);
        Assert.Equal(historicalInvoice.Id, reloadedPayment.InvoiceId);
        Assert.Equal(1180m, reloadedPayment.Amount);

        // Vehicle service history must still include historical Job Card
        var vehicleJobCards = await db.JobCards.Where(j => j.VehicleId == vehicle.Id).ToListAsync();
        Assert.Contains(vehicleJobCards, j => j.JobCardNumber == "JC-2026-000010" && j.CustomerId == customerA.Id);
    }

    [Fact]
    public async Task TransferOwnership_FutureJobCard_BelongsToNewCustomer()
    {
        var (db, service, auditLog, customerA, customerB, vehicle) = CreateTestContext();

        // Transfer vehicle to Customer B
        await service.TransferOwnershipAsync(vehicle.Id, customerB.Id);

        // Create a new Job Card for Customer B and Vehicle
        var newJobCard = new JobCard
        {
            Id = Guid.NewGuid(),
            JobCardNumber = "JC-2026-000099",
            CustomerId = customerB.Id,
            VehicleId = vehicle.Id,
            Status = JobCardStatus.Draft,
            TotalAmount = 500m
        };
        db.JobCards.Add(newJobCard);
        await db.SaveChangesAsync();

        var reloaded = await db.JobCards.FindAsync(newJobCard.Id);
        Assert.NotNull(reloaded);
        Assert.Equal(customerB.Id, reloaded.CustomerId);
        Assert.Equal(vehicle.Id, reloaded.VehicleId);
    }

    [Fact]
    public async Task TransferOwnership_ToSameCustomer_ThrowsConflictException()
    {
        var (db, service, auditLog, customerA, customerB, vehicle) = CreateTestContext();

        // Attempting to transfer to Customer A (current owner)
        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            service.TransferOwnershipAsync(vehicle.Id, customerA.Id));

        Assert.Equal("Vehicle is already owned by this customer.", ex.Message);
    }

    [Fact]
    public async Task TransferOwnership_MissingVehicle_ThrowsNotFoundException()
    {
        var (db, service, auditLog, customerA, customerB, vehicle) = CreateTestContext();

        var missingVehicleId = Guid.NewGuid();
        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            service.TransferOwnershipAsync(missingVehicleId, customerB.Id));

        Assert.Contains("was not found", ex.Message);
    }

    [Fact]
    public async Task TransferOwnership_MissingCustomer_ThrowsNotFoundException()
    {
        var (db, service, auditLog, customerA, customerB, vehicle) = CreateTestContext();

        var missingCustomerId = Guid.NewGuid();
        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            service.TransferOwnershipAsync(vehicle.Id, missingCustomerId));

        Assert.Contains("was not found", ex.Message);
    }

    [Fact]
    public async Task TransferOwnership_InactiveOrSoftDeletedCustomer_ThrowsNotFoundException()
    {
        var (db, service, auditLog, customerA, customerB, vehicle) = CreateTestContext();

        // Soft-delete Customer B
        customerB.IsDeleted = true;
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            service.TransferOwnershipAsync(vehicle.Id, customerB.Id));

        Assert.Contains("was not found", ex.Message);
    }

    [Fact]
    public async Task VehiclesController_Create_ReturnsStructured409_WithExistingVehicleDetails()
    {
        var (db, service, auditLog, customerA, customerB, vehicle) = CreateTestContext();
        var customerService = new CustomerService(db, new RecordingAuditLogService());
        var controller = new VehiclesController(service, customerService);

        // Customer B tries to register vehicle with same registration
        var req = new CreateVehicleRequest
        {
            RegistrationNumber = "TN 56 P 3334",
            Make = "Maruti",
            Model = "Baleno",
            CustomerId = customerB.Id
        };

        var result = await controller.Create(req, CancellationToken.None);
        var conflictResult = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal(409, conflictResult.StatusCode);

        // Verify structured details
        dynamic data = conflictResult.Value!;
        Assert.NotNull(data);

        // Use reflection to check properties on the anonymous object
        var type = data.GetType() as Type;
        Assert.NotNull(type);
        var existingCustId = (Guid)type.GetProperty("existingCustomerId")!.GetValue(data)!;
        var existingCustName = (string)type.GetProperty("existingCustomerName")!.GetValue(data)!;
        var reg = (string)type.GetProperty("registrationNumber")!.GetValue(data)!;

        Assert.Equal(customerA.Id, existingCustId);
        Assert.Equal("Person A", existingCustName);
        Assert.Equal("TN56P3334", reg);
    }

    [Fact]
    public async Task VehiclesController_TransferOwnership_ReturnsOkResult()
    {
        var (db, service, auditLog, customerA, customerB, vehicle) = CreateTestContext();
        var customerService = new CustomerService(db, new RecordingAuditLogService());
        var controller = new VehiclesController(service, customerService);

        var request = new TransferVehicleOwnershipRequest
        {
            NewCustomerId = customerB.Id
        };

        var result = await controller.TransferOwnership(vehicle.Id, request, CancellationToken.None);
        var okResult = Assert.IsType<OkObjectResult>(result);
        var dto = Assert.IsType<VehicleDto>(okResult.Value);

        Assert.Equal(vehicle.Id, dto.Id);
        Assert.Equal(customerB.Id, dto.CustomerId);
        Assert.Equal("Person B", dto.CustomerName);
    }

    [Fact]
    public void VehiclesController_TransferOwnership_RequiresVehiclesEditPermission()
    {
        var method = typeof(VehiclesController).GetMethod(nameof(VehiclesController.TransferOwnership));
        Assert.NotNull(method);

        var attr = method.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(attr);
        Assert.Equal("Permission:vehicles.edit", attr.Policy);
    }
}
