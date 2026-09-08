using System.Reflection;
using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class InvoiceCancellationTests
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
        public string? NormalizePhoneNumber(string? phone) => phone;
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
        InvoiceStatus invoiceStatus = InvoiceStatus.Generated,
        decimal totalAmount = 1000m,
        decimal paidAmount = 0m)
    {
        var now = DateTime.UtcNow;
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = "John Doe",
            PhoneNumber = "9876543210",
            CreatedAt = now,
            UpdatedAt = now
        };
        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid(),
            CustomerId = customer.Id,
            RegistrationNumber = "TN33AB1234",
            Make = "Hyundai",
            Model = "Creta",
            CreatedAt = now,
            UpdatedAt = now
        };
        var jobCard = new JobCard
        {
            Id = Guid.NewGuid(),
            JobCardNumber = "JC-2026-000001",
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Status = JobCardStatus.Invoiced,
            Subtotal = totalAmount,
            TotalAmount = totalAmount,
            CreatedAt = now,
            UpdatedAt = now
        };
        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = "INV-2026-000001",
            JobCardId = jobCard.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceDate = now.Date,
            Subtotal = totalAmount,
            TaxableAmount = totalAmount,
            TotalAmount = totalAmount,
            PaidAmount = paidAmount,
            BalanceAmount = totalAmount - paidAmount,
            Status = invoiceStatus,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Customers.Add(customer);
        db.Vehicles.Add(vehicle);
        db.JobCards.Add(jobCard);
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();

        return (customer, vehicle, jobCard, invoice);
    }

    [Fact]
    public async Task CancelInvoiceAsync_WhenInvoiceExistsAndUnpaid_CancelsSuccessfullyAndRevertsJobCardToReady()
    {
        // Arrange
        var (db, service) = CreateTestServices();
        var (_, _, jobCard, invoice) = await SeedInvoiceAsync(db, InvoiceStatus.Generated);

        // Act
        var result = await service.CancelInvoiceAsync(invoice.Id, "Customer requested order cancellation");

        // Assert
        Assert.NotNull(result);
        Assert.Equal(InvoiceStatus.Cancelled, result.Status);

        var dbInvoice = await db.Invoices.FindAsync(invoice.Id);
        Assert.NotNull(dbInvoice);
        Assert.Equal(InvoiceStatus.Cancelled, dbInvoice.Status);
        Assert.Contains("Cancelled: Customer requested order cancellation", dbInvoice.Notes ?? string.Empty);

        var dbJobCard = await db.JobCards.FindAsync(jobCard.Id);
        Assert.NotNull(dbJobCard);
        Assert.Equal(JobCardStatus.Ready, dbJobCard.Status);
    }

    [Fact]
    public async Task CancelInvoiceAsync_WhenInvoiceAlreadyCancelled_ThrowsInvalidOperationException()
    {
        // Arrange
        var (db, service) = CreateTestServices();
        var (_, _, _, invoice) = await SeedInvoiceAsync(db, InvoiceStatus.Cancelled);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CancelInvoiceAsync(invoice.Id, "Double cancel test"));

        Assert.Equal("Invoice is already cancelled.", ex.Message);
    }

    [Fact]
    public async Task CancelInvoiceAsync_WhenInvoiceHasPayments_ThrowsInvalidOperationException()
    {
        // Arrange
        var (db, service) = CreateTestServices();
        var (_, _, _, invoice) = await SeedInvoiceAsync(db, InvoiceStatus.PartiallyPaid, totalAmount: 1000m, paidAmount: 500m);

        db.Payments.Add(new Payment
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoice.Id,
            Amount = 500m,
            PaymentMethod = PaymentMethod.Cash,
            PaymentDate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CancelInvoiceAsync(invoice.Id, "Cancel paid invoice test"));

        Assert.Contains("Cannot cancel an invoice with recorded payments", ex.Message);
    }

    [Fact]
    public async Task CancelInvoiceAsync_WhenActivePublicLinksExist_RevokesAllPublicLinks()
    {
        // Arrange
        var (db, service) = CreateTestServices();
        var (_, _, _, invoice) = await SeedInvoiceAsync(db, InvoiceStatus.Generated);

        var publicLink = new InvoicePublicLink
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoice.Id,
            TokenHash = "abc123hash",
            CreatedAtUtc = DateTime.UtcNow,
            IsRevoked = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.InvoicePublicLinks.Add(publicLink);
        await db.SaveChangesAsync();

        // Act
        await service.CancelInvoiceAsync(invoice.Id, "Cancel with link test");

        // Assert
        var dbLink = await db.InvoicePublicLinks.FindAsync(publicLink.Id);
        Assert.NotNull(dbLink);
        Assert.True(dbLink.IsRevoked);
        Assert.NotNull(dbLink.RevokedAtUtc);
    }

    [Fact]
    public void InvoicesController_CancelEndpoint_HasRequirePermissionAttribute()
    {
        // Arrange
        var method = typeof(InvoicesController).GetMethod(nameof(InvoicesController.Cancel));

        // Assert
        Assert.NotNull(method);
        var attr = method.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(attr);
        Assert.Equal("Permission:invoices.cancel", attr.Policy);
    }
}
