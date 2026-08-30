using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Xunit;
using JCard = CarSpaManagement.Api.Domain.Entities.JobCard;
using JCardService = CarSpaManagement.Api.Domain.Entities.JobCardService;
using JobCardServiceApp = CarSpaManagement.Api.Application.Services.JobCardService;

namespace CarSpaManagement.Api.Tests;

public class JobCardInvoiceLockTests
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

    private class DummyAuthorizationService : IAuthorizationService
    {
        public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, IEnumerable<IAuthorizationRequirement> requirements) =>
            Task.FromResult(AuthorizationResult.Success());

        public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, string policyName) =>
            Task.FromResult(AuthorizationResult.Success());
    }

    private class DummyWebHostEnvironment : IWebHostEnvironment
    {
        public string WebRootPath { get; set; } = string.Empty;
        public IFileProvider WebRootFileProvider { get; set; } = null!;
        public string ApplicationName { get; set; } = "TestApp";
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; } = string.Empty;
        public string EnvironmentName { get; set; } = "Development";
    }

    private static (AppDbContext db, IJobCardService service) CreateTestServices()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName)
                   .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

        var provider = services.BuildServiceProvider();
        var db = provider.GetRequiredService<AppDbContext>();
        var auditLog = new DummyAuditLogService();
        var jobCardService = new JobCardServiceApp(db, auditLog);

        return (db, jobCardService);
    }

    private static async Task<(Customer customer, Vehicle vehicle, Service service1, Service service2, JCard jobCard)> SeedJobCardHierarchyAsync(AppDbContext db, JobCardStatus status = JobCardStatus.Draft)
    {
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = "John Doe",
            PhoneNumber = "9876543210",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Customers.Add(customer);

        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid(),
            CustomerId = customer.Id,
            RegistrationNumber = "KA01AB1234",
            Make = "Hyundai",
            Model = "Creta",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Vehicles.Add(vehicle);

        var service1 = new Service
        {
            Id = Guid.NewGuid(),
            Name = "Premium Foam Wash",
            Category = "Exterior",
            Price = 500,
            TaxPercentage = 18,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var service2 = new Service
        {
            Id = Guid.NewGuid(),
            Name = "Interior Deep Clean",
            Category = "Interior",
            Price = 1200,
            TaxPercentage = 18,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Services.AddRange(service1, service2);

        var jobCard = new JCard
        {
            Id = Guid.NewGuid(),
            JobCardNumber = "JC-2026-000101",
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Status = status,
            Subtotal = 500,
            TaxAmount = 90,
            DiscountAmount = 0,
            TotalAmount = 590,
            Notes = "Initial customer instructions",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            JobCardServices = new List<JCardService>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    ServiceId = service1.Id,
                    ServiceName = service1.Name,
                    UnitPrice = service1.Price,
                    Quantity = 1,
                    TaxPercentage = service1.TaxPercentage,
                    DiscountAmount = 0,
                    LineTotal = 590,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            }
        };
        db.JobCards.Add(jobCard);
        await db.SaveChangesAsync();

        return (customer, vehicle, service1, service2, jobCard);
    }

    [Fact]
    public async Task JobCard_WithoutInvoice_CanBeEditedSuccessfully()
    {
        var (db, jobCardService) = CreateTestServices();
        var (_, _, _, service2, jobCard) = await SeedJobCardHierarchyAsync(db);

        var request = new UpdateJobCardServicesRequest
        {
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = service2.Id, Quantity = 2, DiscountAmount = 0 }
            },
            Notes = "Updated notes before invoice"
        };

        var result = await jobCardService.UpdateServicesAsync(jobCard.Id, request);

        Assert.NotNull(result);
        Assert.Equal("Updated notes before invoice", result.Notes);
        Assert.Single(result.Services);
        Assert.Equal(service2.Name, result.Services[0].ServiceName);
        Assert.Equal(2, result.Services[0].Quantity);
        Assert.Equal(2400, result.Subtotal);
        Assert.Equal(2832, result.TotalAmount);
    }

    [Fact]
    public async Task JobCard_WithDraftInvoice_CanBeEditedSuccessfully()
    {
        var (db, jobCardService) = CreateTestServices();
        var (customer, vehicle, _, service2, jobCard) = await SeedJobCardHierarchyAsync(db);

        // Draft invoice exists (no invoice number issued yet)
        var draftInvoice = new Invoice
        {
            Id = Guid.NewGuid(),
            JobCardId = jobCard.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceNumber = null,
            Status = InvoiceStatus.Draft,
            Subtotal = 500,
            TotalAmount = 590,
            BalanceAmount = 590,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Invoices.Add(draftInvoice);
        await db.SaveChangesAsync();

        var request = new UpdateJobCardServicesRequest
        {
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = service2.Id, Quantity = 1, DiscountAmount = 0 }
            },
            Notes = "Edited while invoice is still in Draft"
        };

        var result = await jobCardService.UpdateServicesAsync(jobCard.Id, request);

        Assert.NotNull(result);
        Assert.Equal("Edited while invoice is still in Draft", result.Notes);
        Assert.Equal(service2.Name, result.Services[0].ServiceName);
    }

    [Fact]
    public async Task JobCard_WithGeneratedInvoice_UpdateServices_ThrowsConflictException()
    {
        var (db, jobCardService) = CreateTestServices();
        var (customer, vehicle, _, service2, jobCard) = await SeedJobCardHierarchyAsync(db, JobCardStatus.Invoiced);

        // Generated / Finalized invoice with official invoice number
        var finalizedInvoice = new Invoice
        {
            Id = Guid.NewGuid(),
            JobCardId = jobCard.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceNumber = "INV-2026-000001",
            Status = InvoiceStatus.Generated,
            Subtotal = 500,
            TotalAmount = 590,
            BalanceAmount = 590,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Invoices.Add(finalizedInvoice);
        await db.SaveChangesAsync();

        var request = new UpdateJobCardServicesRequest
        {
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = service2.Id, Quantity = 1, DiscountAmount = 0 }
            },
            Notes = "Attempt to edit locked job card"
        };

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            jobCardService.UpdateServicesAsync(jobCard.Id, request));

        Assert.Equal("This job card is locked because its invoice has already been generated.", ex.Message);
    }

    [Fact]
    public async Task JobCard_WithGeneratedInvoice_Delete_ThrowsConflictException()
    {
        var (db, jobCardService) = CreateTestServices();
        var (customer, vehicle, _, _, jobCard) = await SeedJobCardHierarchyAsync(db, JobCardStatus.Invoiced);

        var finalizedInvoice = new Invoice
        {
            Id = Guid.NewGuid(),
            JobCardId = jobCard.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceNumber = "INV-2026-000002",
            Status = InvoiceStatus.Generated,
            Subtotal = 500,
            TotalAmount = 590,
            BalanceAmount = 590,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Invoices.Add(finalizedInvoice);
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            jobCardService.DeleteAsync(jobCard.Id));

        Assert.Equal("This job card is locked because its invoice has already been generated.", ex.Message);
    }

    [Fact]
    public async Task JobCard_WithPaidInvoice_RemainsLocked()
    {
        var (db, jobCardService) = CreateTestServices();
        var (customer, vehicle, _, service2, jobCard) = await SeedJobCardHierarchyAsync(db, JobCardStatus.Paid);

        var paidInvoice = new Invoice
        {
            Id = Guid.NewGuid(),
            JobCardId = jobCard.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceNumber = "INV-2026-000003",
            Status = InvoiceStatus.Paid,
            Subtotal = 500,
            TotalAmount = 590,
            PaidAmount = 590,
            BalanceAmount = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Invoices.Add(paidInvoice);
        await db.SaveChangesAsync();

        var request = new UpdateJobCardServicesRequest
        {
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = service2.Id, Quantity = 1, DiscountAmount = 0 }
            },
            Notes = "Attempt to edit paid job card"
        };

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            jobCardService.UpdateServicesAsync(jobCard.Id, request));

        Assert.Equal("This job card is locked because its invoice has already been generated.", ex.Message);
    }

    [Fact]
    public async Task JobCard_WithCancelledInvoice_WhereInvoiceNumberWasIssued_RemainsPermanentlyLocked()
    {
        var (db, jobCardService) = CreateTestServices();
        var (customer, vehicle, _, service2, jobCard) = await SeedJobCardHierarchyAsync(db, JobCardStatus.Invoiced);

        // Cancelled invoice but an official invoice number was issued
        var cancelledInvoice = new Invoice
        {
            Id = Guid.NewGuid(),
            JobCardId = jobCard.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceNumber = "INV-2026-000004",
            Status = InvoiceStatus.Cancelled,
            Subtotal = 500,
            TotalAmount = 590,
            BalanceAmount = 590,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Invoices.Add(cancelledInvoice);
        await db.SaveChangesAsync();

        var request = new UpdateJobCardServicesRequest
        {
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = service2.Id, Quantity = 1, DiscountAmount = 0 }
            },
            Notes = "Attempt to edit cancelled but previously issued job card"
        };

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            jobCardService.UpdateServicesAsync(jobCard.Id, request));

        Assert.Equal("This job card is locked because its invoice has already been generated.", ex.Message);
    }

    [Fact]
    public async Task JobCardsController_DirectApiUpdate_WhenLocked_Returns409Conflict()
    {
        var (db, jobCardService) = CreateTestServices();
        var (customer, vehicle, _, service2, jobCard) = await SeedJobCardHierarchyAsync(db, JobCardStatus.Invoiced);

        var finalizedInvoice = new Invoice
        {
            Id = Guid.NewGuid(),
            JobCardId = jobCard.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceNumber = "INV-2026-000005",
            Status = InvoiceStatus.Generated,
            Subtotal = 500,
            TotalAmount = 590,
            BalanceAmount = 590,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Invoices.Add(finalizedInvoice);
        await db.SaveChangesAsync();

        var authService = new DummyAuthorizationService();
        var env = new DummyWebHostEnvironment();

        var controller = new JobCardsController(jobCardService, authService, env)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var request = new UpdateJobCardServicesRequest
        {
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = service2.Id, Quantity = 1, DiscountAmount = 0 }
            },
            Notes = "Direct API update attempt"
        };

        var result = await controller.UpdateServices(jobCard.Id, request, CancellationToken.None);

        var conflictResult = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal(409, conflictResult.StatusCode);

        var errorValue = conflictResult.Value?.GetType().GetProperty("error")?.GetValue(conflictResult.Value)?.ToString();
        Assert.Equal("This job card is locked because its invoice has already been generated.", errorValue);
    }

    [Fact]
    public async Task JobCardsController_DirectApiDelete_WhenLocked_Returns409Conflict()
    {
        var (db, jobCardService) = CreateTestServices();
        var (customer, vehicle, _, _, jobCard) = await SeedJobCardHierarchyAsync(db, JobCardStatus.Invoiced);

        var finalizedInvoice = new Invoice
        {
            Id = Guid.NewGuid(),
            JobCardId = jobCard.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceNumber = "INV-2026-000006",
            Status = InvoiceStatus.Generated,
            Subtotal = 500,
            TotalAmount = 590,
            BalanceAmount = 590,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Invoices.Add(finalizedInvoice);
        await db.SaveChangesAsync();

        var authService = new DummyAuthorizationService();
        var env = new DummyWebHostEnvironment();

        var controller = new JobCardsController(jobCardService, authService, env)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var result = await controller.Delete(jobCard.Id, CancellationToken.None);

        var conflictResult = Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal(409, conflictResult.StatusCode);

        var errorValue = conflictResult.Value?.GetType().GetProperty("error")?.GetValue(conflictResult.Value)?.ToString();
        Assert.Equal("This job card is locked because its invoice has already been generated.", errorValue);
    }

    [Fact]
    public async Task JobCard_WhenLocked_ViewingAndPrinting_StillWorks()
    {
        var (db, jobCardService) = CreateTestServices();
        var (customer, vehicle, _, _, jobCard) = await SeedJobCardHierarchyAsync(db, JobCardStatus.Invoiced);

        var finalizedInvoice = new Invoice
        {
            Id = Guid.NewGuid(),
            JobCardId = jobCard.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceNumber = "INV-2026-000007",
            Status = InvoiceStatus.Generated,
            Subtotal = 500,
            TotalAmount = 590,
            BalanceAmount = 590,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Invoices.Add(finalizedInvoice);
        await db.SaveChangesAsync();

        // 1. GetByIdAsync
        var byId = await jobCardService.GetByIdAsync(jobCard.Id);
        Assert.NotNull(byId);
        Assert.Equal(jobCard.JobCardNumber, byId.JobCardNumber);
        Assert.Equal(finalizedInvoice.Id, byId.InvoiceId);
        Assert.Equal("INV-2026-000007", byId.InvoiceNumber);
        Assert.Equal("Generated", byId.InvoiceStatus);

        // 2. GetByNumberAsync
        var byNumber = await jobCardService.GetByNumberAsync(jobCard.JobCardNumber);
        Assert.NotNull(byNumber);
        Assert.Equal(jobCard.Id, byNumber.Id);

        // 3. GetForPrintAsync
        var forPrint = await jobCardService.GetForPrintAsync(jobCard.Id);
        Assert.NotNull(forPrint);
        Assert.Equal(jobCard.JobCardNumber, forPrint.JobCardNumber);
        Assert.Equal(customer.Name, forPrint.Customer.Name);
        Assert.Equal(vehicle.RegistrationNumber, forPrint.Vehicle.RegistrationNumber);
        Assert.Single(forPrint.Services);
    }
}
