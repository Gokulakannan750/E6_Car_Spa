using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class InvoiceSearchTests
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

    private class DummyWhatsAppService : IWhatsAppService
    {
        public Task<Application.DTOs.WhatsApp.WhatsAppConfigResponse> GetConfigurationAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(new Application.DTOs.WhatsApp.WhatsAppConfigResponse(false, "", "", "v25.0", false, false, false, "", "en", "", "en", DateTime.UtcNow));
        public Task<Application.DTOs.WhatsApp.WhatsAppConfigResponse> UpdateConfigurationAsync(Application.DTOs.WhatsApp.UpdateWhatsAppConfigRequest request, Guid? userId = null, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<Application.DTOs.WhatsApp.TestWhatsAppConnectionResponse> TestConnectionAsync(Application.DTOs.WhatsApp.TestWhatsAppConnectionRequest? request = null, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<WhatsAppMessage?> QueueInvoiceFinalizedNotificationAsync(Guid invoiceId, CancellationToken cancellationToken = default) => Task.FromResult<WhatsAppMessage?>(null);
        public Task<WhatsAppMessage?> QueuePaymentCompletedNotificationAsync(Guid invoiceId, decimal paymentAmount, string? publicInvoiceUrl = null, CancellationToken cancellationToken = default) => Task.FromResult<WhatsAppMessage?>(null);
        public Task<IReadOnlyList<Application.DTOs.WhatsApp.InvoiceWhatsAppStatusDto>> GetInvoiceWhatsAppStatusAsync(Guid invoiceId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Application.DTOs.WhatsApp.InvoiceWhatsAppStatusDto>>(new List<Application.DTOs.WhatsApp.InvoiceWhatsAppStatusDto>());
        public Task<Application.DTOs.WhatsApp.MetaWhatsAppTemplatesResponse> GetMetaTemplatesAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<Application.DTOs.WhatsApp.SendTestWhatsAppMessageResponse> SendTestTemplateMessageAsync(Application.DTOs.WhatsApp.SendTestWhatsAppMessageRequest request, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<bool> ProcessMessageAsync(Guid messageId, CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task ProcessPendingMessagesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<Application.DTOs.WhatsApp.WhatsAppHealthDto> GetHealthStatusAsync(bool forceProbe = false, CancellationToken cancellationToken = default) =>
            Task.FromResult(new Application.DTOs.WhatsApp.WhatsAppHealthDto(Domain.Enums.WhatsAppHealthStatus.NotConfigured.ToString(), null, null, null, null, false));
        public Task ProbeHealthAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public string? NormalizePhoneNumber(string? phone) => phone;
    }

    private static (AppDbContext db, IInvoiceService service) CreateTestServices()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(opts =>
            opts.UseInMemoryDatabase(dbName)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

        services.AddSingleton<IAuditLogService, DummyAuditLogService>();
        services.AddSingleton<IWhatsAppService, DummyWhatsAppService>();
        services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
        services.AddScoped<IInvoiceService, InvoiceService>();

        var provider = services.BuildServiceProvider();
        var scope = provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var invoiceService = scope.ServiceProvider.GetRequiredService<IInvoiceService>();

        return (db, invoiceService);
    }

    private static async Task<(Customer customer, Vehicle vehicle, JobCard jobCard, Invoice invoice)> SeedInvoiceAsync(
        AppDbContext db,
        string? invoiceNumber = "INV-2026-000101",
        string jobCardNumber = "JC-2026-000101",
        string customerName = "Arun Vijay",
        string registrationNumber = "TN07AA1234",
        InvoiceStatus invoiceStatus = InvoiceStatus.Generated)
    {
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = customerName,
            PhoneNumber = "9876543210",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid(),
            CustomerId = customer.Id,
            RegistrationNumber = registrationNumber,
            Make = "Hyundai",
            Model = "Creta",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var jobCard = new JobCard
        {
            Id = Guid.NewGuid(),
            JobCardNumber = jobCardNumber,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Status = JobCardStatus.Invoiced,
            Subtotal = 2000m,
            TaxAmount = 360m,
            TotalAmount = 2360m,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = invoiceNumber,
            JobCardId = jobCard.Id,
            JobCard = jobCard,
            CustomerId = customer.Id,
            Customer = customer,
            VehicleId = vehicle.Id,
            Vehicle = vehicle,
            InvoiceDate = DateTime.UtcNow.Date,
            Subtotal = 2000m,
            Discount = 0m,
            TaxableAmount = 2000m,
            GstAmount = 360m,
            TotalAmount = 2360m,
            PaidAmount = 2360m,
            BalanceAmount = 0m,
            Status = invoiceStatus,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jobCard);
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();

        return (customer, vehicle, jobCard, invoice);
    }

    [Fact]
    public async Task Search_ByInvoiceNumber_ReturnsMatchingInvoice()
    {
        var (db, service) = CreateTestServices();
        await SeedInvoiceAsync(db, invoiceNumber: "INV-2026-000501", jobCardNumber: "JC-2026-000501");
        await SeedInvoiceAsync(db, invoiceNumber: "INV-2026-000502", jobCardNumber: "JC-2026-000502");

        var results = await service.GetAllAsync(1, 10, search: "INV-2026-000501");
        var count = await service.GetTotalCountAsync(search: "INV-2026-000501");

        Assert.Single(results);
        Assert.Equal("INV-2026-000501", results[0].InvoiceNumber);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task Search_ByCustomerName_ReturnsMatchingInvoice()
    {
        var (db, service) = CreateTestServices();
        await SeedInvoiceAsync(db, customerName: "Rajesh Kannan", invoiceNumber: "INV-2026-000503", jobCardNumber: "JC-2026-000503");
        await SeedInvoiceAsync(db, customerName: "Deepak Chopra", invoiceNumber: "INV-2026-000504", jobCardNumber: "JC-2026-000504");

        var results = await service.GetAllAsync(1, 10, search: "Rajesh");
        var count = await service.GetTotalCountAsync(search: "Rajesh");

        Assert.Single(results);
        Assert.Equal("Rajesh Kannan", results[0].CustomerName);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task Search_ByVehicleRegistration_ReturnsMatchingInvoice()
    {
        var (db, service) = CreateTestServices();
        await SeedInvoiceAsync(db, registrationNumber: "TN11ZZ9999", invoiceNumber: "INV-2026-000505", jobCardNumber: "JC-2026-000505");
        await SeedInvoiceAsync(db, registrationNumber: "KA05YY8888", invoiceNumber: "INV-2026-000506", jobCardNumber: "JC-2026-000506");

        var results = await service.GetAllAsync(1, 10, search: "TN11ZZ9999");
        var count = await service.GetTotalCountAsync(search: "TN11ZZ9999");

        Assert.Single(results);
        Assert.Equal("TN11ZZ9999", results[0].RegistrationNumber);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task Search_ByJobCardNumber_ReturnsAssociatedInvoice()
    {
        var (db, service) = CreateTestServices();
        await SeedInvoiceAsync(db, invoiceNumber: "INV-2026-000507", jobCardNumber: "JC-2026-000777");
        await SeedInvoiceAsync(db, invoiceNumber: "INV-2026-000508", jobCardNumber: "JC-2026-000888");

        var results = await service.GetAllAsync(1, 10, search: "JC-2026-000777");
        var count = await service.GetTotalCountAsync(search: "JC-2026-000777");

        Assert.Single(results);
        Assert.Equal("INV-2026-000507", results[0].InvoiceNumber);
        Assert.Equal("JC-2026-000777", results[0].JobCardNumber);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task Search_ByPartialJobCardNumber_ReturnsMatchingInvoice()
    {
        var (db, service) = CreateTestServices();
        await SeedInvoiceAsync(db, invoiceNumber: "INV-2026-000509", jobCardNumber: "JC-2026-998877");
        await SeedInvoiceAsync(db, invoiceNumber: "INV-2026-000510", jobCardNumber: "JC-2026-112233");

        var results = await service.GetAllAsync(1, 10, search: "998877");
        var count = await service.GetTotalCountAsync(search: "998877");

        Assert.Single(results);
        Assert.Equal("JC-2026-998877", results[0].JobCardNumber);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task Search_ByCaseInsensitiveJobCardNumber_ReturnsMatchingInvoice()
    {
        var (db, service) = CreateTestServices();
        await SeedInvoiceAsync(db, invoiceNumber: "INV-2026-000511", jobCardNumber: "JC-2026-000511");

        // lowercase search
        var resultsLower = await service.GetAllAsync(1, 10, search: "jc-2026-000511");
        var countLower = await service.GetTotalCountAsync(search: "jc-2026-000511");

        Assert.Single(resultsLower);
        Assert.Equal("INV-2026-000511", resultsLower[0].InvoiceNumber);
        Assert.Equal(1, countLower);

        // uppercase search
        var resultsUpper = await service.GetAllAsync(1, 10, search: "JC-2026-000511");
        var countUpper = await service.GetTotalCountAsync(search: "JC-2026-000511");

        Assert.Single(resultsUpper);
        Assert.Equal("INV-2026-000511", resultsUpper[0].InvoiceNumber);
        Assert.Equal(1, countUpper);
    }

    [Fact]
    public async Task Search_ByUnrelatedJobCardNumber_DoesNotReturnInvoice()
    {
        var (db, service) = CreateTestServices();
        await SeedInvoiceAsync(db, invoiceNumber: "INV-2026-000512", jobCardNumber: "JC-2026-000512");

        var results = await service.GetAllAsync(1, 10, search: "JC-9999-999999");
        var count = await service.GetTotalCountAsync(search: "JC-9999-999999");

        Assert.Empty(results);
        Assert.Equal(0, count);
    }

    [Fact]
    public async Task Search_WithNoMatch_ReturnsEmptyListAndZeroCount()
    {
        var (db, service) = CreateTestServices();
        await SeedInvoiceAsync(db, invoiceNumber: "INV-2026-000513", jobCardNumber: "JC-2026-000513");

        var results = await service.GetAllAsync(1, 10, search: "NONEXISTENT_QUERY_XYZ");
        var count = await service.GetTotalCountAsync(search: "NONEXISTENT_QUERY_XYZ");

        Assert.Empty(results);
        Assert.Equal(0, count);
    }

    [Fact]
    public async Task Search_WithStatusFilterAndPagination_PreservesExistingFiltering()
    {
        var (db, service) = CreateTestServices();
        // Seed matching job card number, but one is Draft, one is Paid
        await SeedInvoiceAsync(db, invoiceNumber: null, jobCardNumber: "JC-MATCH-01", invoiceStatus: InvoiceStatus.Draft);
        await SeedInvoiceAsync(db, invoiceNumber: "INV-2026-000514", jobCardNumber: "JC-MATCH-02", invoiceStatus: InvoiceStatus.Paid);

        // Search for "JC-MATCH" with status Draft
        var draftResults = await service.GetAllAsync(1, 10, search: "JC-MATCH", status: InvoiceStatus.Draft);
        var draftCount = await service.GetTotalCountAsync(search: "JC-MATCH", status: InvoiceStatus.Draft);

        Assert.Single(draftResults);
        Assert.Equal(InvoiceStatus.Draft, draftResults[0].Status);
        Assert.Equal(1, draftCount);

        // Search for "JC-MATCH" with status Paid
        var paidResults = await service.GetAllAsync(1, 10, search: "JC-MATCH", status: InvoiceStatus.Paid);
        var paidCount = await service.GetTotalCountAsync(search: "JC-MATCH", status: InvoiceStatus.Paid);

        Assert.Single(paidResults);
        Assert.Equal(InvoiceStatus.Paid, paidResults[0].Status);
        Assert.Equal(1, paidCount);
    }

    [Fact]
    public async Task Search_DoesNotDuplicateInvoices()
    {
        var (db, service) = CreateTestServices();
        // Create an invoice where the customer name, invoice number, and job card number all share a common substring
        await SeedInvoiceAsync(
            db,
            invoiceNumber: "INV-COMMON-123",
            jobCardNumber: "JC-COMMON-123",
            customerName: "COMMON User",
            registrationNumber: "TN01COMMON");

        var results = await service.GetAllAsync(1, 10, search: "COMMON");
        var count = await service.GetTotalCountAsync(search: "COMMON");

        Assert.Single(results);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task Search_CountMatchesReturnedResults()
    {
        var (db, service) = CreateTestServices();
        for (int i = 1; i <= 5; i++)
        {
            await SeedInvoiceAsync(db, invoiceNumber: $"INV-BATCH-{i:D3}", jobCardNumber: $"JC-BATCH-{i:D3}");
        }

        var results = await service.GetAllAsync(1, 10, search: "BATCH");
        var count = await service.GetTotalCountAsync(search: "BATCH");

        Assert.Equal(5, results.Count);
        Assert.Equal(5, count);
    }

    [Fact]
    public async Task Search_WithInvoiceWithoutJobCard_DoesNotThrow()
    {
        var (db, service) = CreateTestServices();
        var customer = new Customer { Id = Guid.NewGuid(), Name = "Orphan Cust", PhoneNumber = "9999999999", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), CustomerId = customer.Id, RegistrationNumber = "TN00ORPHAN", Make = "Ford", Model = "Figo", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        
        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        await db.SaveChangesAsync();

        // Invoice with null JobCard navigation
        var orphanInvoice = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-ORPHAN-001",
            JobCardId = Guid.Empty,
            JobCard = null!,
            CustomerId = customer.Id,
            Customer = customer,
            VehicleId = vehicle.Id,
            Vehicle = vehicle,
            InvoiceDate = DateTime.UtcNow.Date,
            TotalAmount = 1000m,
            PaidAmount = 1000m,
            BalanceAmount = 0m,
            Status = InvoiceStatus.Paid,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.Invoices.Add(orphanInvoice);
        await db.SaveChangesAsync();

        // Searching should not throw even with JobCard = null
        var ex = await Record.ExceptionAsync(async () =>
        {
            await service.GetAllAsync(1, 10, search: "ORPHAN");
            await service.GetTotalCountAsync(search: "ORPHAN");
        });

        Assert.Null(ex);
    }
}
