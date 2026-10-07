using System.Reflection;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.DTOs.OutsideJobs;
using CarSpaManagement.Api.Application.DTOs.Vendors;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using JCard = CarSpaManagement.Api.Domain.Entities.JobCard;
using JobCardAppService = CarSpaManagement.Api.Application.Services.JobCardService;

namespace CarSpaManagement.Api.Tests;

public class VendorAndMovementSafetyTests
{
    private class TestAuditLogService : IAuditLogService
    {
        public List<(string action, string description, string? entityType, Guid? entityId)> RecordedLogs { get; } = new();

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
            RecordedLogs.Add((action, description, entityType, entityId));
            return Task.CompletedTask;
        }

        public Task<PagedResult<AuditLogDto>> GetLogsAsync(AuditLogQueryParameters query, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();
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
        public Task<CarSpaManagement.Api.Application.DTOs.WhatsApp.WhatsAppUsageResponse> GetUsageAsync(int months = 6, CancellationToken cancellationToken = default) =>
            Task.FromResult(new CarSpaManagement.Api.Application.DTOs.WhatsApp.WhatsAppUsageResponse(Array.Empty<CarSpaManagement.Api.Application.DTOs.WhatsApp.WhatsAppUsageMonthDto>()));

        public Task<Application.DTOs.WhatsApp.WhatsAppHealthDto> GetHealthStatusAsync(bool forceProbe = false, CancellationToken cancellationToken = default) =>
            Task.FromResult(new Application.DTOs.WhatsApp.WhatsAppHealthDto(Domain.Enums.WhatsAppHealthStatus.NotConfigured.ToString(), null, null, null, null, false));
        public Task ProbeHealthAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public string? NormalizePhoneNumber(string? phone) => phone;
    }

    private static (AppDbContext db, IOutsideJobService outsideJobService, IVendorService vendorService, IJobCardService jobCardService, IInvoiceService invoiceService, TestAuditLogService audit) CreateTestEnvironment()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName)
                   .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

        var audit = new TestAuditLogService();
        services.AddSingleton<IAuditLogService>(audit);
        services.AddSingleton<IWhatsAppService, DummyWhatsAppService>();
        services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["PublicInvoiceBaseUrl"] = "http://localhost:5173"
        }).Build());
        services.AddScoped<IInvoiceService, InvoiceService>();

        var provider = services.BuildServiceProvider();
        var scope = provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var outsideJobService = new OutsideJobService(db, audit);
        var vendorService = new VendorService(db, audit);
        var jobCardService = new JobCardAppService(db, audit);
        var invoiceService = scope.ServiceProvider.GetRequiredService<IInvoiceService>();

        return (db, outsideJobService, vendorService, jobCardService, invoiceService, audit);
    }

    private static async Task<(Customer customer, Vehicle vehicle, Vendor vendor, JCard jobCard)> SeedDataAsync(AppDbContext db)
    {
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = "Suresh Kumar",
            PhoneNumber = "9876543210",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Customers.Add(customer);

        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid(),
            CustomerId = customer.Id,
            RegistrationNumber = "TN33CD5678",
            Make = "Toyota",
            Model = "Innova",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Vehicles.Add(vehicle);

        var vendor = new Vendor
        {
            Id = Guid.NewGuid(),
            Name = "Sri Lakshmi Auto Works",
            Phone = "9876543210",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Vendors.Add(vendor);

        var jobCard = new JCard
        {
            Id = Guid.NewGuid(),
            JobCardNumber = "JC-2026-9001",
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Status = JobCardStatus.InProgress,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.JobCards.Add(jobCard);

        await db.SaveChangesAsync();
        return (customer, vehicle, vendor, jobCard);
    }

    // 1. Create vendor with valid 10-digit phone -> succeeds.
    [Fact]
    public async Task Test01_CreateVendor_Valid10DigitPhone_Succeeds()
    {
        var (_, _, vendorService, _, _, _) = CreateTestEnvironment();
        var req = new CreateVendorRequest("Sri Krishna Motors", "9876543210", "Gopal", "Perundurai Road", "Mechanical");
        var res = await vendorService.CreateAsync(req);

        Assert.NotNull(res);
        Assert.Equal("9876543210", res.Phone);
        Assert.Equal("Sri Krishna Motors", res.Name);
    }

    // 2. Create vendor with 9-digit phone -> fails.
    [Fact]
    public async Task Test02_CreateVendor_9DigitPhone_Fails()
    {
        var (_, _, vendorService, _, _, _) = CreateTestEnvironment();
        var req = new CreateVendorRequest("Short Phone Vendor", "987654321", null, null, null);
        var ex = await Assert.ThrowsAsync<ArgumentException>(() => vendorService.CreateAsync(req));
        Assert.Contains("Phone number must be exactly 10 digits", ex.Message);
    }

    // 3. Create vendor with 11-digit phone -> fails.
    [Fact]
    public async Task Test03_CreateVendor_11DigitPhone_Fails()
    {
        var (_, _, vendorService, _, _, _) = CreateTestEnvironment();
        var req = new CreateVendorRequest("Long Phone Vendor", "98765432100", null, null, null);
        var ex = await Assert.ThrowsAsync<ArgumentException>(() => vendorService.CreateAsync(req));
        Assert.Contains("Phone number must be exactly 10 digits", ex.Message);
    }

    // 4. Create vendor with alphabetic phone -> fails.
    [Fact]
    public async Task Test04_CreateVendor_AlphabeticPhone_Fails()
    {
        var (_, _, vendorService, _, _, _) = CreateTestEnvironment();
        var req = new CreateVendorRequest("Alpha Phone Vendor", "98765abcde", null, null, null);
        var ex = await Assert.ThrowsAsync<ArgumentException>(() => vendorService.CreateAsync(req));
        Assert.Contains("Phone number must be exactly 10 digits", ex.Message);
    }

    // 5. Create vendor with special characters -> fails.
    [Fact]
    public async Task Test05_CreateVendor_SpecialCharactersPhone_Fails()
    {
        var (_, _, vendorService, _, _, _) = CreateTestEnvironment();
        var req = new CreateVendorRequest("Special Char Vendor", "98765-43210", null, null, null);
        var ex = await Assert.ThrowsAsync<ArgumentException>(() => vendorService.CreateAsync(req));
        Assert.Contains("Phone number must be exactly 10 digits", ex.Message);

        var req2 = new CreateVendorRequest("Space Char Vendor", "987 654 3210", null, null, null);
        var ex2 = await Assert.ThrowsAsync<ArgumentException>(() => vendorService.CreateAsync(req2));
        Assert.Contains("Phone number must be exactly 10 digits", ex2.Message);
    }

    // 6. Update vendor with valid phone -> succeeds.
    [Fact]
    public async Task Test06_UpdateVendor_ValidPhone_Succeeds()
    {
        var (_, _, vendorService, _, _, _) = CreateTestEnvironment();
        var created = await vendorService.CreateAsync(new CreateVendorRequest("Original Vendor", "9876543210", null, null, null));

        var updateReq = new UpdateVendorRequest("Updated Vendor", "9123456780", null, null, null, true);
        var updated = await vendorService.UpdateAsync(created.Id, updateReq);

        Assert.NotNull(updated);
        Assert.Equal("9123456780", updated.Phone);
    }

    // 7. Update vendor with invalid phone -> fails.
    [Fact]
    public async Task Test07_UpdateVendor_InvalidPhone_Fails()
    {
        var (_, _, vendorService, _, _, _) = CreateTestEnvironment();
        var created = await vendorService.CreateAsync(new CreateVendorRequest("Original Vendor", "9876543210", null, null, null));

        var updateReq = new UpdateVendorRequest("Updated Vendor", "12345", null, null, null, true);
        var ex = await Assert.ThrowsAsync<ArgumentException>(() => vendorService.UpdateAsync(created.Id, updateReq));
        Assert.Contains("Phone number must be exactly 10 digits", ex.Message);
    }

    // 8. Update movement vendor cost -> succeeds.
    [Fact]
    public async Task Test08_UpdateMovementVendorCost_Succeeds()
    {
        var (db, outsideJobService, _, _, _, _) = CreateTestEnvironment();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        var job = await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Wheel Alignment",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-2),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(2),
            VendorCost: null,
            Notes: "Initial send"));

        var updated = await outsideJobService.UpdateCostAsync(job.Id, new UpdateOutsideJobCostRequest(1250.50m));
        Assert.NotNull(updated);
        Assert.Equal(1250.50m, updated.VendorCost);

        var fetched = await outsideJobService.GetByIdAsync(job.Id);
        Assert.Equal(1250.50m, fetched?.VendorCost);
    }

    // 9. Negative vendor cost -> fails.
    [Fact]
    public async Task Test09_NegativeVendorCost_Fails()
    {
        var (db, outsideJobService, _, _, _, _) = CreateTestEnvironment();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        var job = await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Painting",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-2),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(2),
            VendorCost: null,
            Notes: null));

        var ex = await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            outsideJobService.UpdateCostAsync(job.Id, new UpdateOutsideJobCostRequest(-500m)));
        Assert.Contains("Vendor cost cannot be negative", ex.Message);

        var ex2 = await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            outsideJobService.MarkReturnedAsync(job.Id, new MarkOutsideJobReturnedRequest(
                ReturnedAt: DateTime.UtcNow,
                VendorCost: -100m,
                ReturnNotes: null)));
        Assert.Contains("Vendor cost cannot be negative", ex2.Message);
    }

    // 10. Delete/obsolete movement -> succeeds where allowed.
    [Fact]
    public async Task Test10_DeleteMovement_SucceedsWhereAllowed()
    {
        var (db, outsideJobService, _, _, _, _) = CreateTestEnvironment();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        var job = await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Unneeded Work",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-2),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(2),
            VendorCost: null,
            Notes: "Mistaken entry"));

        var deleted = await outsideJobService.DeleteAsync(job.Id);
        Assert.True(deleted);

        // Record is soft-deleted
        var entity = await db.OutsideJobs.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == job.Id);
        Assert.NotNull(entity);
        Assert.True(entity.IsDeleted);

        // Excluded from active jobs for Job Card
        var activeJobs = await outsideJobService.GetByJobCardIdAsync(jobCard.Id);
        Assert.DoesNotContain(activeJobs, j => j.Id == job.Id);
    }

    // 11. Obsolete movement is excluded from invoice validation.
    [Fact]
    public async Task Test11_ObsoleteMovement_IsExcludedFromInvoiceValidation()
    {
        var (db, outsideJobService, _, _, invoiceService, _) = CreateTestEnvironment();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        // Create an outside job with missing cost
        var job = await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Cancelled Detailing",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-2),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(2),
            VendorCost: null,
            Notes: "Obsolete"));

        // Soft delete the movement
        await outsideJobService.DeleteAsync(job.Id);

        // Generating invoice now succeeds because the obsolete movement is excluded
        var invoice = await invoiceService.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
        Assert.NotNull(invoice);
        Assert.DoesNotContain(invoice.Items, i => i.OutsideJobId == job.Id);
    }

    // 12. Invoice generation with active movement + missing vendor cost -> FAILS.
    [Fact]
    public async Task Test12_InvoiceGeneration_ActiveMovement_MissingVendorCost_Fails()
    {
        var (db, outsideJobService, _, _, invoiceService, _) = CreateTestEnvironment();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Painting Work",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-2),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(2),
            VendorCost: null, // MISSING
            Notes: null));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            invoiceService.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id)));

        Assert.Contains("Vendor cost is required for all outside jobs before generating the invoice", ex.Message);
        Assert.Contains("Painting Work", ex.Message);
    }

    // 13. Invoice generation with active movement + valid vendor cost -> SUCCEEDS.
    [Fact]
    public async Task Test13_InvoiceGeneration_ActiveMovement_ValidVendorCost_Succeeds()
    {
        var (db, outsideJobService, _, _, invoiceService, _) = CreateTestEnvironment();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        var job = await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Bumper Painting",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-3),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(1),
            VendorCost: 4500m,
            Notes: null));

        await outsideJobService.MarkReturnedAsync(job.Id, new MarkOutsideJobReturnedRequest(
            ReturnedAt: DateTime.UtcNow,
            VendorCost: 4500m,
            ReturnNotes: "Completed"));

        var invoice = await invoiceService.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
        Assert.NotNull(invoice);
        var item = Assert.Single(invoice.Items, i => i.OutsideJobId == job.Id);
        Assert.Equal(4500m, item.UnitPrice);
    }

    // 14. Invoice generation with multiple movements where one lacks vendor cost -> FAILS.
    [Fact]
    public async Task Test14_InvoiceGeneration_MultipleMovements_OneLacksCost_Fails()
    {
        var (db, outsideJobService, _, _, invoiceService, _) = CreateTestEnvironment();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        // Job 1 has cost and is marked returned so vehicle is back
        var job1 = await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Denting Work",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-4),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(-2),
            VendorCost: 3000m,
            Notes: null));

        await outsideJobService.MarkReturnedAsync(job1.Id, new MarkOutsideJobReturnedRequest(
            ReturnedAt: DateTime.UtcNow.AddHours(-1),
            VendorCost: 3000m,
            ReturnNotes: "Completed"));

        // Job 2 is sent outside and has missing vendor cost
        var job2 = await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Glass Polishing",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-1),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(1),
            VendorCost: null, // MISSING
            Notes: null));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            invoiceService.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id)));

        Assert.Contains("Vendor cost is required for all outside jobs before generating the invoice", ex.Message);
        Assert.Contains("Glass Polishing", ex.Message);
    }

    // 15. Invoice generation after all vendor costs are entered -> SUCCEEDS.
    [Fact]
    public async Task Test15_InvoiceGeneration_AfterAllVendorCostsEntered_Succeeds()
    {
        var (db, outsideJobService, _, _, invoiceService, _) = CreateTestEnvironment();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        var job1 = await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Denting Work",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-4),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(-2),
            VendorCost: 3000m,
            Notes: null));

        await outsideJobService.MarkReturnedAsync(job1.Id, new MarkOutsideJobReturnedRequest(
            ReturnedAt: DateTime.UtcNow.AddHours(-1),
            VendorCost: 3000m,
            ReturnNotes: "Completed"));

        var job2 = await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Glass Polishing",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-1),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(1),
            VendorCost: null,
            Notes: null));

        // Update the missing vendor cost
        await outsideJobService.UpdateCostAsync(job2.Id, new UpdateOutsideJobCostRequest(1200m));

        var invoice = await invoiceService.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
        Assert.NotNull(invoice);
    }

    // 16. Attempt to edit vendor cost after invoice finalization -> FAILS.
    [Fact]
    public async Task Test16_EditVendorCost_AfterInvoiceFinalization_Fails()
    {
        var (db, outsideJobService, _, _, invoiceService, _) = CreateTestEnvironment();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        var job = await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Full Coating",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-5),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(1),
            VendorCost: 5000m,
            Notes: null));

        await outsideJobService.MarkReturnedAsync(job.Id, new MarkOutsideJobReturnedRequest(
            ReturnedAt: DateTime.UtcNow,
            VendorCost: 5000m,
            ReturnNotes: "Done"));

        // Create draft invoice and then finalize/generate it
        var draftInvoice = await invoiceService.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
        await invoiceService.GenerateInvoiceAsync(draftInvoice.Id, expectedTotalAmount: draftInvoice.TotalAmount);

        // Attempt to edit vendor cost after finalization must fail
        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            outsideJobService.UpdateCostAsync(job.Id, new UpdateOutsideJobCostRequest(6000m)));

        Assert.Contains("invoice has already been generated", ex.Message);
    }

    // 17. Attempt to delete movement after invoice finalization -> FAILS.
    [Fact]
    public async Task Test17_DeleteMovement_AfterInvoiceFinalization_Fails()
    {
        var (db, outsideJobService, _, _, invoiceService, _) = CreateTestEnvironment();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        var job = await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Interior Deep Clean",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-5),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(1),
            VendorCost: 3500m,
            Notes: null));

        await outsideJobService.MarkReturnedAsync(job.Id, new MarkOutsideJobReturnedRequest(
            ReturnedAt: DateTime.UtcNow,
            VendorCost: 3500m,
            ReturnNotes: "Done"));

        var draftInvoice = await invoiceService.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
        await invoiceService.GenerateInvoiceAsync(draftInvoice.Id, expectedTotalAmount: draftInvoice.TotalAmount);

        // Attempt to delete movement after finalization must fail
        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            outsideJobService.DeleteAsync(job.Id));

        Assert.Contains("invoice has already been generated", ex.Message);
    }

    // 18. Unauthorized user cannot modify/delete movement.
    [Fact]
    public void Test18_UnauthorizedUser_CannotModifyOrDeleteMovement()
    {
        // RBAC P1-3: outside-job mutations require outsidejobs.manage (no longer jobcards.edit).
        var updateCostMethod = typeof(OutsideJobsController).GetMethod(nameof(OutsideJobsController.UpdateCost));
        Assert.NotNull(updateCostMethod);

        var updateCostPerm = updateCostMethod.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(updateCostPerm);
        Assert.Equal("Permission:outsidejobs.manage", updateCostPerm.Policy);

        var deleteMethod = typeof(OutsideJobsController).GetMethod(nameof(OutsideJobsController.Delete));
        Assert.NotNull(deleteMethod);

        var deletePerm = deleteMethod.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(deletePerm);
        Assert.Equal("Permission:outsidejobs.manage", deletePerm.Policy);
    }

    // 19. Android/Desktop use the same backend business rule.
    [Fact]
    public async Task Test19_AndroidAndDesktop_UseSameBackendBusinessRule()
    {
        // Both clients call the unified backend services:
        // UpdateCostAsync enforces decimal >= 0 and locked invoice checks
        // DeleteAsync enforces soft-delete and locked invoice checks
        // InvoiceService enforces vendor cost mandatory rule before invoice creation/finalization
        var (db, outsideJobService, _, _, invoiceService, _) = CreateTestEnvironment();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        var job = await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Cross Platform Check",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-1),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(1),
            VendorCost: null,
            Notes: null));

        // Both Android and Desktop are blocked at backend level if cost is missing
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            invoiceService.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id)));

        // Updating cost through the unified service allows invoice generation
        await outsideJobService.UpdateCostAsync(job.Id, new UpdateOutsideJobCostRequest(2000m));
        var invoice = await invoiceService.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
        Assert.NotNull(invoice);
    }
}
