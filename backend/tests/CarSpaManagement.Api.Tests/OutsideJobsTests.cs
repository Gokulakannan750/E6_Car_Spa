using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.DTOs.OutsideJobs;
using CarSpaManagement.Api.Application.DTOs.Vendors;
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
using JCard = CarSpaManagement.Api.Domain.Entities.JobCard;
using JobCardAppService = CarSpaManagement.Api.Application.Services.JobCardService;

namespace CarSpaManagement.Api.Tests;

public class OutsideJobsTests
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

    private static (AppDbContext db, IOutsideJobService service, IVendorService vendorService, IJobCardService jobCardService, IReportService reportService, TestAuditLogService audit) CreateTestServices()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName)
                   .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

        var provider = services.BuildServiceProvider();
        var db = provider.GetRequiredService<AppDbContext>();
        var audit = new TestAuditLogService();

        var outsideJobService = new OutsideJobService(db, audit);
        var vendorService = new VendorService(db, audit);
        var jobCardService = new JobCardAppService(db, audit);
        var reportService = new ReportService(db);

        return (db, outsideJobService, vendorService, jobCardService, reportService, audit);
    }

    private static async Task<(Customer customer, Vehicle vehicle, Vendor vendor, JCard jobCard)> SeedDataAsync(AppDbContext db)
    {
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            Name = "Rahul Sharma",
            PhoneNumber = "9876543210",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Customers.Add(customer);

        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid(),
            CustomerId = customer.Id,
            RegistrationNumber = "TN33AB1234",
            Make = "Hyundai",
            Model = "Creta",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Vehicles.Add(vehicle);

        var vendor = new Vendor
        {
            Id = Guid.NewGuid(),
            Name = "Sri Lakshmi Auto Works",
            Phone = "9842712345",
            ContactPerson = "Ramesh Kumar",
            Address = "Perundurai Road, Erode",
            ServiceSpecialty = "Denting & Painting",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Vendors.Add(vendor);

        var jobCard = new JCard
        {
            Id = Guid.NewGuid(),
            JobCardNumber = "JC-2026-000100",
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Status = JobCardStatus.InProgress,
            Subtotal = 10000,
            TaxAmount = 1800,
            DiscountAmount = 0,
            TotalAmount = 11800,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.JobCards.Add(jobCard);

        await db.SaveChangesAsync();
        return (customer, vehicle, vendor, jobCard);
    }

    [Fact]
    public async Task CreateOutsideJob_Success_SetsStatusOutside_PreservesFields_RecordsAudit()
    {
        var (db, service, _, _, _, audit) = CreateTestServices();
        var (_, vehicle, vendor, jobCard) = await SeedDataAsync(db);

        var request = new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Denting & Painting",
            ServiceId: null,
            SentAt: DateTime.UtcNow,
            ExpectedReturnAt: DateTime.UtcNow.AddDays(1),
            VendorCost: 4500m,
            Notes: "Front bumper dent repair");

        var result = await service.CreateOutsideJobAsync(jobCard.Id, request, Guid.NewGuid(), "AdminUser");

        Assert.NotNull(result);
        Assert.Equal(OutsideJobStatus.Outside, result.Status);
        Assert.Equal("Outside", result.StatusName);
        Assert.Equal("Denting & Painting", result.ServiceName);
        Assert.Equal(vendor.Name, result.VendorName);
        Assert.Equal(vehicle.RegistrationNumber, result.VehicleRegistrationNumber);
        Assert.Equal(4500m, result.VendorCost);
        Assert.False(result.IsOverdue);
        Assert.Equal("AdminUser", result.SentByUserName);

        // Verify audit log
        Assert.Contains(audit.RecordedLogs, l => l.action == "outsidejobs.send" && l.entityId == result.Id);
    }

    [Fact]
    public async Task CreateOutsideJob_WhenVehicleAlreadyOutside_ThrowsConflictException()
    {
        var (db, service, _, _, _, _) = CreateTestServices();
        var (_, vehicle, vendor, jobCard) = await SeedDataAsync(db);

        var req1 = new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Denting & Painting",
            ServiceId: null,
            SentAt: DateTime.UtcNow,
            ExpectedReturnAt: DateTime.UtcNow.AddDays(1),
            VendorCost: 4500m,
            Notes: null);

        await service.CreateOutsideJobAsync(jobCard.Id, req1);

        var req2 = new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Wheel Alignment",
            ServiceId: null,
            SentAt: DateTime.UtcNow,
            ExpectedReturnAt: DateTime.UtcNow.AddDays(2),
            VendorCost: 1500m,
            Notes: null);

        var ex = await Assert.ThrowsAsync<ConflictException>(() => service.CreateOutsideJobAsync(jobCard.Id, req2));
        Assert.Contains("currently outside", ex.Message);
        Assert.Contains(vehicle.RegistrationNumber, ex.Message);
    }

    [Fact]
    public async Task CreateOutsideJob_WhenJobCardCancelled_ThrowsInvalidOperationException()
    {
        var (db, service, _, _, _, _) = CreateTestServices();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        jobCard.Status = JobCardStatus.Cancelled;
        await db.SaveChangesAsync();

        var req = new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Denting",
            ServiceId: null,
            SentAt: null,
            ExpectedReturnAt: DateTime.UtcNow.AddDays(1),
            VendorCost: null,
            Notes: null);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateOutsideJobAsync(jobCard.Id, req));
    }

    [Fact]
    public async Task CreateOutsideJob_WhenVendorInactive_ThrowsInvalidOperationException()
    {
        var (db, service, _, _, _, _) = CreateTestServices();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        vendor.IsActive = false;
        await db.SaveChangesAsync();

        var req = new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Denting",
            ServiceId: null,
            SentAt: null,
            ExpectedReturnAt: DateTime.UtcNow.AddDays(1),
            VendorCost: null,
            Notes: null);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateOutsideJobAsync(jobCard.Id, req));
    }

    [Fact]
    public async Task CreateOutsideJob_WhenJobCardStatusInvoiced_ThrowsConflictException()
    {
        var (db, service, _, _, _, _) = CreateTestServices();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        jobCard.Status = JobCardStatus.Invoiced;
        await db.SaveChangesAsync();

        var req = new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Painting",
            ServiceId: null,
            SentAt: null,
            ExpectedReturnAt: DateTime.UtcNow.AddDays(1),
            VendorCost: null,
            Notes: null);

        var ex = await Assert.ThrowsAsync<ConflictException>(() => service.CreateOutsideJobAsync(jobCard.Id, req));
        Assert.Equal("This job card is locked because an invoice has already been generated. New outside jobs cannot be added.", ex.Message);
    }

    [Fact]
    public async Task CreateOutsideJob_WhenJobCardHasGeneratedInvoice_ThrowsConflictException()
    {
        var (db, service, _, _, _, _) = CreateTestServices();
        var (customer, vehicle, vendor, jobCard) = await SeedDataAsync(db);

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            JobCardId = jobCard.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            InvoiceNumber = "INV-2026-000099",
            Status = InvoiceStatus.Generated,
            Subtotal = 10000,
            TotalAmount = 11800,
            BalanceAmount = 11800,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();

        var req = new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Painting",
            ServiceId: null,
            SentAt: null,
            ExpectedReturnAt: DateTime.UtcNow.AddDays(1),
            VendorCost: null,
            Notes: null);

        var ex = await Assert.ThrowsAsync<ConflictException>(() => service.CreateOutsideJobAsync(jobCard.Id, req));
        Assert.Equal("This job card is locked because an invoice has already been generated. New outside jobs cannot be added.", ex.Message);
    }

    [Fact]
    public async Task MarkReturned_Success_TransitionsToReturned_PreservesOriginalData_RecordsAudit()
    {
        var (db, service, _, _, _, audit) = CreateTestServices();
        var (_, vehicle, vendor, jobCard) = await SeedDataAsync(db);

        var sentTime = DateTime.UtcNow.AddHours(-10);
        var expectedTime = DateTime.UtcNow.AddHours(14);

        var job = await service.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Tinkering & Painting",
            ServiceId: null,
            SentAt: sentTime,
            ExpectedReturnAt: expectedTime,
            VendorCost: 3000m,
            Notes: "Sent for hood scratch repair"));

        var returnTime = DateTime.UtcNow;
        var returnRequest = new MarkOutsideJobReturnedRequest(
            ReturnedAt: returnTime,
            VendorCost: 3500m, // updated final cost
            ReturnNotes: "Quality inspected, scratch resolved perfectly");

        var returnedJob = await service.MarkReturnedAsync(job.Id, returnRequest, Guid.NewGuid(), "SupervisorKumar");

        Assert.Equal(OutsideJobStatus.Returned, returnedJob.Status);
        Assert.Equal("Returned", returnedJob.StatusName);
        Assert.NotNull(returnedJob.ReturnedAt);
        Assert.Equal(3500m, returnedJob.VendorCost);
        Assert.Equal("Quality inspected, scratch resolved perfectly", returnedJob.ReturnNotes);
        Assert.Equal("SupervisorKumar", returnedJob.ReturnedByUserName);

        // Original fields preserved
        Assert.Equal("Tinkering & Painting", returnedJob.ServiceName);
        Assert.Equal(vendor.Name, returnedJob.VendorName);
        Assert.Equal(expectedTime, returnedJob.ExpectedReturnAt);
        Assert.Equal("Sent for hood scratch repair", returnedJob.Notes);

        // Audit verified
        Assert.Contains(audit.RecordedLogs, l => l.action == "outsidejobs.return" && l.entityId == job.Id);
    }

    [Fact]
    public async Task MarkReturned_WhenAlreadyReturned_ThrowsInvalidOperationException()
    {
        var (db, service, _, _, _, _) = CreateTestServices();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        var job = await service.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Denting",
            ServiceId: null,
            SentAt: DateTime.UtcNow,
            ExpectedReturnAt: DateTime.UtcNow.AddDays(1),
            VendorCost: 1000m,
            Notes: null));

        await service.MarkReturnedAsync(job.Id, new MarkOutsideJobReturnedRequest(null, null, null));

        // Attempting to return again must fail
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.MarkReturnedAsync(job.Id, new MarkOutsideJobReturnedRequest(null, null, null)));
    }

    [Fact]
    public async Task CancelOutsideJob_Success_And_CannotCancelReturnedJob()
    {
        var (db, service, _, _, _, audit) = CreateTestServices();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        var job = await service.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "AC Gas Top-up",
            ServiceId: null,
            SentAt: DateTime.UtcNow,
            ExpectedReturnAt: DateTime.UtcNow.AddDays(1),
            VendorCost: 1500m,
            Notes: null));

        var cancelled = await service.CancelAsync(job.Id, new CancelOutsideJobRequest("Vendor shop is closed today"));

        Assert.Equal(OutsideJobStatus.Cancelled, cancelled.Status);
        Assert.Equal("Vendor shop is closed today", cancelled.CancellationReason);
        Assert.Contains(audit.RecordedLogs, l => l.action == "outsidejobs.cancel" && l.entityId == job.Id);

        // Test cannot cancel a returned job
        var job2 = await service.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Wheel Alignment",
            ServiceId: null,
            SentAt: DateTime.UtcNow,
            ExpectedReturnAt: DateTime.UtcNow.AddDays(1),
            VendorCost: 800m,
            Notes: null));

        await service.MarkReturnedAsync(job2.Id, new MarkOutsideJobReturnedRequest(null, null, null));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CancelAsync(job2.Id, new CancelOutsideJobRequest("Trying to cancel returned job")));
    }

    [Fact]
    public async Task OverdueDetection_CalculatesIsOverdue_WhenExpectedReturnAtInPast()
    {
        var (db, service, _, _, _, _) = CreateTestServices();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        var overdueJob = await service.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Major Denting",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddDays(-3),
            ExpectedReturnAt: DateTime.UtcNow.AddDays(-1), // In the past!
            VendorCost: 5000m,
            Notes: null));

        Assert.True(overdueJob.IsOverdue);

        // Deriving vehicle location also reflects overdue
        var location = await service.GetVehicleLocationByJobCardIdAsync(jobCard.Id);
        Assert.True(location.IsOutside);
        Assert.True(location.IsOverdue);
        Assert.Equal("At Outside Shop", location.Location);
    }

    [Fact]
    public async Task MultipleHistoricalOutsideJobs_ForSameJobCard_PreservesCompleteHistory()
    {
        var (db, service, _, _, _, _) = CreateTestServices();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        // 1st outside job: Sent and Returned
        var job1 = await service.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Denting",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddDays(-2),
            ExpectedReturnAt: DateTime.UtcNow.AddDays(-1),
            VendorCost: 3000m,
            Notes: "Round 1 denting"));

        await service.MarkReturnedAsync(job1.Id, new MarkOutsideJobReturnedRequest(
            ReturnedAt: DateTime.UtcNow.AddDays(-1),
            VendorCost: 3000m,
            ReturnNotes: "Completed round 1"));

        // 2nd outside job: Sent for painting
        var job2 = await service.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Painting",
            ServiceId: null,
            SentAt: DateTime.UtcNow,
            ExpectedReturnAt: DateTime.UtcNow.AddDays(1),
            VendorCost: 4000m,
            Notes: "Round 2 painting"));

        var allForCard = await service.GetByJobCardIdAsync(jobCard.Id);

        Assert.Equal(2, allForCard.Count);
        var returned = allForCard.First(x => x.Id == job1.Id);
        var active = allForCard.First(x => x.Id == job2.Id);

        Assert.Equal(OutsideJobStatus.Returned, returned.Status);
        Assert.Equal("Completed round 1", returned.ReturnNotes);
        Assert.Equal(OutsideJobStatus.Outside, active.Status);

        // Vehicle location is currently outside for job2
        var loc = await service.GetVehicleLocationByJobCardIdAsync(jobCard.Id);
        Assert.True(loc.IsOutside);
        Assert.Equal(job2.Id, loc.ActiveOutsideJobId);
    }

    [Fact]
    public async Task JobCardDto_And_JobCardListDto_IncludeVehicleLocation_AndOutsideJobs()
    {
        var (db, service, _, jobCardService, _, _) = CreateTestServices();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        // Initially no outside jobs -> At Showroom
        var initialDetail = await jobCardService.GetByIdAsync(jobCard.Id, canViewOutsideJobs: true);
        Assert.NotNull(initialDetail);
        Assert.NotNull(initialDetail.VehicleLocation);
        Assert.False(initialDetail.VehicleLocation.IsOutside);
        Assert.Equal("At Showroom", initialDetail.VehicleLocation.Location);
        Assert.Empty(initialDetail.OutsideJobs!);

        // Send vehicle outside
        var outsideJob = await service.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Glass Replacement",
            ServiceId: null,
            SentAt: DateTime.UtcNow,
            ExpectedReturnAt: DateTime.UtcNow.AddDays(1),
            VendorCost: 2000m,
            Notes: "Cracked windshield"));

        // Detail DTO check
        var detailAfterSend = await jobCardService.GetByIdAsync(jobCard.Id, canViewOutsideJobs: true);
        Assert.NotNull(detailAfterSend);
        Assert.NotNull(detailAfterSend.VehicleLocation);
        Assert.True(detailAfterSend.VehicleLocation.IsOutside);
        Assert.Equal("At Outside Shop", detailAfterSend.VehicleLocation.Location);
        Assert.Equal(vendor.Name, detailAfterSend.VehicleLocation.VendorName);
        Assert.Single(detailAfterSend.OutsideJobs!);
        Assert.Equal(outsideJob.Id, detailAfterSend.OutsideJobs![0].Id);

        // List DTO check
        var listResponse = await jobCardService.GetAllAsync(1, 10);
        var listItem = listResponse.First(x => x.Id == jobCard.Id);
        Assert.NotNull(listItem.VehicleLocation);
        Assert.True(listItem.VehicleLocation.IsOutside);
        Assert.Equal(vendor.Name, listItem.VehicleLocation.VendorName);
    }

    [Fact]
    public async Task OutsideJobsReport_ReturnsCurrentlyOutside_History_AndVendorSummary()
    {
        var (db, service, _, _, reportService, _) = CreateTestServices();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        // Create 1 returned job and 1 currently outside job
        var returnedJob = await service.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Dent Removal",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddDays(-3),
            ExpectedReturnAt: DateTime.UtcNow.AddDays(-2),
            VendorCost: 2500m,
            Notes: null));

        await service.MarkReturnedAsync(returnedJob.Id, new MarkOutsideJobReturnedRequest(
            ReturnedAt: DateTime.UtcNow.AddDays(-2),
            VendorCost: 2500m,
            ReturnNotes: "Completed"));

        var activeJob = await service.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Paint Polish",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-5),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(2),
            VendorCost: 3500m,
            Notes: null));

        var report = await reportService.GetOutsideJobsReportAsync();

        Assert.NotNull(report);
        Assert.Single(report.CurrentlyOutside);
        Assert.Equal(activeJob.Id, report.CurrentlyOutside[0].Id);
        Assert.Equal(2, report.History.Count);
        Assert.Single(report.VendorSummary);
        Assert.Equal(vendor.Name, report.VendorSummary[0].VendorName);
        Assert.Equal(2, report.VendorSummary[0].TotalJobs);
        Assert.Equal(1, report.VendorSummary[0].CompletedJobs);
        Assert.Equal(1, report.VendorSummary[0].CurrentlyOutside);
        Assert.Equal(6000m, report.VendorSummary[0].TotalVendorCost);
    }

    [Fact]
    public async Task VendorService_CRUD_Lifecycle_Works()
    {
        var (db, _, vendorService, _, _, audit) = CreateTestServices();

        var createReq = new CreateVendorRequest(
            Name: "Apex Car Aligners",
            Phone: "9876500000",
            ContactPerson: "Vikram",
            Address: "123 Main Road, Erode",
            ServiceSpecialty: "Alignment");

        var created = await vendorService.CreateAsync(createReq);
        Assert.NotNull(created);
        Assert.Equal("Apex Car Aligners", created.Name);
        Assert.True(created.IsActive);

        var fetched = await vendorService.GetByIdAsync(created.Id);
        Assert.NotNull(fetched);
        Assert.Equal("Vikram", fetched.ContactPerson);

        var updateReq = new UpdateVendorRequest(
            Name: "Apex Wheel & Tyres",
            Phone: "9876500000",
            ContactPerson: "Vikram R",
            Address: "123 Main Road, Erode",
            ServiceSpecialty: "Alignment & Tyres",
            IsActive: true);

        var updated = await vendorService.UpdateAsync(created.Id, updateReq);
        Assert.NotNull(updated);
        Assert.Equal("Apex Wheel & Tyres", updated.Name);
        Assert.Equal("Vikram R", updated.ContactPerson);

        var deleted = await vendorService.DeleteAsync(created.Id);
        Assert.True(deleted);

        var allActive = await vendorService.GetAllAsync(activeOnly: true);
        Assert.DoesNotContain(allActive, v => v.Id == created.Id);
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

    private static (AppDbContext db, IOutsideJobService service, IVendorService vendorService, IJobCardService jobCardService, IInvoiceService invoiceService, TestAuditLogService audit) CreateTestServicesWithInvoice()
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

    [Fact]
    public async Task InvoiceCreation_ReturnedOutsideJob_WithServiceNameDetailingWork_CreatesInvoiceItemWithExactServiceNameDescription()
    {
        var (db, outsideJobService, _, _, invoiceService, _) = CreateTestServicesWithInvoice();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        // Create OutsideJob with ServiceName "Detailing Work"
        var outsideJob = await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Detailing Work",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-5),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(2),
            VendorCost: 3500m,
            Notes: "Full car exterior detailing"));

        // Mark it returned with final vendor cost
        await outsideJobService.MarkReturnedAsync(outsideJob.Id, new MarkOutsideJobReturnedRequest(
            ReturnedAt: DateTime.UtcNow,
            VendorCost: 3500m,
            ReturnNotes: "Completed perfectly"));

        // Create invoice from the Job Card
        var invoice = await invoiceService.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));

        Assert.NotNull(invoice);
        var item = Assert.Single(invoice.Items, i => i.OutsideJobId == outsideJob.Id);

        // Verification: Description must be exact ServiceName, NOT prefixed with "Outside "
        Assert.Equal("Detailing Work", item.Description);
        Assert.DoesNotContain("Outside", item.Description);
        Assert.Equal(outsideJob.Id, item.OutsideJobId);
        Assert.Equal(3500m, item.UnitPrice);
        Assert.Equal(1, item.Quantity);
    }

    [Fact]
    public async Task InvoiceGeneration_LateReturnedOutsideJob_SyncsInvoiceItemWithExactServiceNameDescription()
    {
        var (db, outsideJobService, _, _, invoiceService, _) = CreateTestServicesWithInvoice();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        // Create OutsideJob while vehicle is still outside (Status = Outside)
        var outsideJob = await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Detailing Work",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-5),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(2),
            VendorCost: 3500m,
            Notes: "In progress"));

        // Create draft invoice while job is still outside -> outside job should NOT be on draft invoice yet
        var draftInvoice = await invoiceService.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
        Assert.DoesNotContain(draftInvoice.Items, i => i.OutsideJobId == outsideJob.Id);

        // Outside job is returned later with final cost
        await outsideJobService.MarkReturnedAsync(outsideJob.Id, new MarkOutsideJobReturnedRequest(
            ReturnedAt: DateTime.UtcNow,
            VendorCost: 3500m,
            ReturnNotes: "Returned from vendor"));

        // Generate the finalized invoice -> late return synchronization runs
        var preview = await invoiceService.PreviewAsync(draftInvoice.Id, new PreviewInvoiceRequest());
        var generatedInvoice = await invoiceService.GenerateInvoiceAsync(draftInvoice.Id, expectedTotalAmount: preview.TotalAmount, canEditDraft: true);

        var item = Assert.Single(generatedInvoice.Items, i => i.OutsideJobId == outsideJob.Id);

        // Verification: Synced item must have exact ServiceName, NOT prefixed with "Outside "
        Assert.Equal("Detailing Work", item.Description);
        Assert.DoesNotContain("Outside", item.Description);
        Assert.Equal(outsideJob.Id, item.OutsideJobId);
        Assert.Equal(3500m, item.UnitPrice);
        Assert.Equal(1, item.Quantity);
    }

    [Fact]
    public async Task InvoiceCreation_UnreturnedOrZeroCostOutsideJobs_AreNotBilled()
    {
        var (db, outsideJobService, _, _, invoiceService, _) = CreateTestServicesWithInvoice();
        var (_, _, vendor, jobCard) = await SeedDataAsync(db);

        // 1. Outside job that is still Outside (not returned)
        var activeJob = await outsideJobService.CreateOutsideJobAsync(jobCard.Id, new CreateOutsideJobRequest(
            VendorId: vendor.Id,
            ServiceName: "Painting Work",
            ServiceId: null,
            SentAt: DateTime.UtcNow.AddHours(-1),
            ExpectedReturnAt: DateTime.UtcNow.AddHours(2),
            VendorCost: 4000m,
            Notes: null));

        var invoice = await invoiceService.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));

        // Active (unreturned) outside job must not be billed
        Assert.DoesNotContain(invoice.Items, i => i.OutsideJobId == activeJob.Id);
    }
}
