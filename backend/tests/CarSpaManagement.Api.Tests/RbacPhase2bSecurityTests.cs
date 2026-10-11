using CarSpaManagement.Api.Infrastructure.Tenancy;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.DTOs.OutsideJobs;
using CarSpaManagement.Api.Application.DTOs.WhatsApp;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Xunit;

using JCard = CarSpaManagement.Api.Domain.Entities.JobCard;
using JCardSvc = CarSpaManagement.Api.Domain.Entities.JobCardService;
using JobCardAppService = CarSpaManagement.Api.Application.Services.JobCardService;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// RBAC Phase 2B focused security test suite:
/// P2B-1 — Job-card / outside-job data boundary: confidential outside-job/vendor-cost isolation.
/// P2B-2 — Invoice generation integrity: mandatory ExpectedTotalAmount, authoritative totals, draft line mutation protection.
/// </summary>
public class RbacPhase2bSecurityTests
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
            CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<PagedResult<AuditLogDto>> GetLogsAsync(AuditLogQueryParameters query, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();
    }

    private class DummyWhatsAppService : IWhatsAppService
    {
        public Task<WhatsAppConfigResponse> GetConfigurationAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<WhatsAppConfigResponse> UpdateConfigurationAsync(UpdateWhatsAppConfigRequest request, Guid? userId = null, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<TestWhatsAppConnectionResponse> TestConnectionAsync(TestWhatsAppConnectionRequest? request = null, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<WhatsAppMessage?> QueueInvoiceFinalizedNotificationAsync(Guid invoiceId, CancellationToken cancellationToken = default) => Task.FromResult<WhatsAppMessage?>(null);
        public Task<WhatsAppMessage?> QueuePaymentCompletedNotificationAsync(Guid invoiceId, decimal paymentReceived, string? publicInvoiceUrl = null, CancellationToken cancellationToken = default) => Task.FromResult<WhatsAppMessage?>(null);
        public Task<bool> ProcessMessageAsync(Guid messageId, CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task ProcessPendingMessagesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<InvoiceWhatsAppStatusDto>> GetInvoiceWhatsAppStatusAsync(Guid invoiceId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<InvoiceWhatsAppStatusDto>>(new List<InvoiceWhatsAppStatusDto>());
        public Task<MetaWhatsAppTemplatesResponse> GetMetaTemplatesAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<SendTestWhatsAppMessageResponse> SendTestTemplateMessageAsync(SendTestWhatsAppMessageRequest request, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<CarSpaManagement.Api.Application.DTOs.WhatsApp.WhatsAppMessageLogResponse> GetMessageLogAsync(string? status = null, int? year = null, int? month = null, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default) =>
            Task.FromResult(new CarSpaManagement.Api.Application.DTOs.WhatsApp.WhatsAppMessageLogResponse(Array.Empty<CarSpaManagement.Api.Application.DTOs.WhatsApp.WhatsAppMessageLogItemDto>(), 0, page, pageSize));

        public Task<CarSpaManagement.Api.Application.DTOs.WhatsApp.WhatsAppUsageResponse> GetUsageAsync(int months = 6, CancellationToken cancellationToken = default) =>
            Task.FromResult(new CarSpaManagement.Api.Application.DTOs.WhatsApp.WhatsAppUsageResponse(Array.Empty<CarSpaManagement.Api.Application.DTOs.WhatsApp.WhatsAppUsageMonthDto>()));

        public Task<WhatsAppHealthDto> GetHealthStatusAsync(bool forceProbe = false, CancellationToken cancellationToken = default) =>
            Task.FromResult(new WhatsAppHealthDto(Domain.Enums.WhatsAppHealthStatus.NotConfigured.ToString(), null, null, null, null, false));
        public Task ProbeHealthAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public string? NormalizePhoneNumber(string? phone) => phone;
    }

    private class TestHostEnvironment : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Production;
        public string ApplicationName { get; set; } = "CarSpaManagement.Api";
        public string WebRootPath { get; set; } = string.Empty;
        public IFileProvider WebRootFileProvider { get; set; } = default!;
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = default!;
    }

    private class FakeAuthService(bool canEditDraft = false, bool canViewOutsideJobs = false) : IAuthorizationService
    {
        public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, IEnumerable<IAuthorizationRequirement> requirements) =>
            Task.FromResult(AuthorizationResult.Success());

        public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, string policyName)
        {
            if (policyName == "Permission:invoices.edit_draft")
                return Task.FromResult(canEditDraft ? AuthorizationResult.Success() : AuthorizationResult.Failed());
            if (policyName == "Permission:outsidejobs.view")
                return Task.FromResult(canViewOutsideJobs ? AuthorizationResult.Success() : AuthorizationResult.Failed());
            return Task.FromResult(AuthorizationResult.Success());
        }
    }

    private static (AppDbContext Db, JobCardAppService JobCards, InvoiceService Invoices, OutsideJobService OutsideJobs, Customer Cust, Vehicle Veh, Vendor Vend)
        CreateTestEnvironment()
    {
        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(Guid.NewGuid().ToString())
                   .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

        services.AddSingleton<IAuditLogService, DummyAuditLogService>();
        services.AddSingleton<IWhatsAppService, DummyWhatsAppService>();
        services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder().AddInMemoryCollection().Build());
        services.AddScoped<IInvoiceService, InvoiceService>();
        services.AddScoped<IJobCardService, JobCardAppService>();
        services.AddScoped<IOutsideJobService, OutsideJobService>();

        var provider = services.BuildServiceProvider();
        var scope = provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var jobCards = (JobCardAppService)scope.ServiceProvider.GetRequiredService<IJobCardService>();
        var invoices = (InvoiceService)scope.ServiceProvider.GetRequiredService<IInvoiceService>();
        var outsideJobs = (OutsideJobService)scope.ServiceProvider.GetRequiredService<IOutsideJobService>();

        var cust = new Customer { Name = "Rbac Customer", PhoneNumber = "9988776655" };
        var veh = new Vehicle { CustomerId = cust.Id, RegistrationNumber = "TN01AB1234", Make = "Hyundai", Model = "Creta" };
        var vend = new Vendor { Name = "Apex Denting", Phone = "9876543210", IsActive = true };
        db.AddRange(cust, veh, vend);
        db.SaveChanges();

        return (db, jobCards, invoices, outsideJobs, cust, veh, vend);
    }

    private static async Task<(JCard Card, OutsideJob Job)> SeedJobCardWithOutsideJobAsync(
        AppDbContext db, Customer cust, Vehicle veh, Vendor vend, decimal vendorCost = 2500m, OutsideJobStatus status = OutsideJobStatus.Outside)
    {
        var card = new JCard
        {
            JobCardNumber = $"JC-{Guid.NewGuid():N}"[..10].ToUpperInvariant(),
            CustomerId = cust.Id,
            VehicleId = veh.Id,
            Status = JobCardStatus.Draft,
            Subtotal = 1000m,
            TotalAmount = 1000m,
        };
        card.JobCardServices.Add(new JCardSvc
        {
            JobCardId = card.Id,
            ServiceId = Guid.NewGuid(),
            ServiceName = "Wash & Vacuum",
            UnitPrice = 1000m,
            Quantity = 1,
            LineTotal = 1000m,
        });

        var job = new OutsideJob
        {
            JobCardId = card.Id,
            CustomerId = cust.Id,
            VehicleId = veh.Id,
            VendorId = vend.Id,
            ServiceName = "Paintless Dent Repair",
            Status = status,
            SentAt = DateTime.UtcNow.AddHours(-4),
            ExpectedReturnAt = DateTime.UtcNow.AddHours(4),
            ReturnedAt = status == OutsideJobStatus.Returned ? DateTime.UtcNow : null,
            VendorCost = vendorCost,
        };

        db.JobCards.Add(card);
        db.OutsideJobs.Add(job);
        await db.SaveChangesAsync();

        return (card, job);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // P2B-1: JOB-CARD / OUTSIDE-JOB DATA BOUNDARY
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task P2B1_GetByIdAsync_WithoutOutsideJobsPermission_OmitsOutsideJobsAndVendorCost()
    {
        var (db, jobCards, _, _, cust, veh, vend) = CreateTestEnvironment();
        var (card, _) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend, vendorCost: 4500m);

        // Caller has jobcards.view ONLY (canViewOutsideJobs = false)
        var detail = await jobCards.GetByIdAsync(card.Id, canViewOutsideJobs: false);

        Assert.NotNull(detail);
        Assert.Null(detail.OutsideJobs);
        Assert.NotNull(detail.Customer);
        Assert.NotNull(detail.Vehicle);
        Assert.Single(detail.Services);
    }

    [Fact]
    public async Task P2B1_GetByNumberAsync_WithoutOutsideJobsPermission_OmitsOutsideJobsAndVendorCost()
    {
        var (db, jobCards, _, _, cust, veh, vend) = CreateTestEnvironment();
        var (card, _) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend, vendorCost: 4500m);

        // Caller has jobcards.view ONLY (canViewOutsideJobs = false)
        var detail = await jobCards.GetByNumberAsync(card.JobCardNumber, canViewOutsideJobs: false);

        Assert.NotNull(detail);
        Assert.Null(detail.OutsideJobs);
    }

    [Fact]
    public async Task P2B1_GetByIdAsync_WithOutsideJobsPermission_IncludesOutsideJobsAndVendorCost()
    {
        var (db, jobCards, _, _, cust, veh, vend) = CreateTestEnvironment();
        var (card, job) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend, vendorCost: 4500m);

        // Caller has both jobcards.view AND outsidejobs.view (canViewOutsideJobs = true)
        var detail = await jobCards.GetByIdAsync(card.Id, canViewOutsideJobs: true);

        Assert.NotNull(detail);
        Assert.NotNull(detail.OutsideJobs);
        var oj = Assert.Single(detail.OutsideJobs);
        Assert.Equal(job.Id, oj.Id);
        Assert.Equal(4500m, oj.VendorCost);
        Assert.Equal(vend.Name, oj.VendorName);
        Assert.Equal(vend.Phone, oj.VendorPhone);
        Assert.Equal("Paintless Dent Repair", oj.ServiceName);
    }

    [Fact]
    public async Task P2B1_GetByNumberAsync_WithOutsideJobsPermission_IncludesOutsideJobsAndVendorCost()
    {
        var (db, jobCards, _, _, cust, veh, vend) = CreateTestEnvironment();
        var (card, job) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend, vendorCost: 3200m);

        // Caller has both jobcards.view AND outsidejobs.view (canViewOutsideJobs = true)
        var detail = await jobCards.GetByNumberAsync(card.JobCardNumber, canViewOutsideJobs: true);

        Assert.NotNull(detail);
        Assert.NotNull(detail.OutsideJobs);
        var oj = Assert.Single(detail.OutsideJobs);
        Assert.Equal(job.Id, oj.Id);
        Assert.Equal(3200m, oj.VendorCost);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // P2B-2: INVOICE GENERATION INTEGRITY
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task P2B2_GenerateInvoiceAsync_NullExpectedTotal_ThrowsArgumentException()
    {
        var (db, _, invoices, _, cust, veh, vend) = CreateTestEnvironment();
        var (card, _) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend);
        var draft = await invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(card.Id));

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            invoices.GenerateInvoiceAsync(draft.Id, expectedTotalAmount: null));

        Assert.Contains("Expected total amount is required", ex.Message);
    }

    [Fact]
    public async Task P2B2_GenerateInvoiceAsync_NegativeExpectedTotal_ThrowsArgumentOutOfRangeException()
    {
        var (db, _, invoices, _, cust, veh, vend) = CreateTestEnvironment();
        var (card, _) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend);
        var draft = await invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(card.Id));

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            invoices.GenerateInvoiceAsync(draft.Id, expectedTotalAmount: -100m));
    }

    [Fact]
    public async Task P2B2_GenerateInvoiceAsync_MismatchedExpectedTotal_ThrowsConflictException()
    {
        var (db, _, invoices, _, cust, veh, vend) = CreateTestEnvironment();
        var (card, _) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend);
        var draft = await invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(card.Id));

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            invoices.GenerateInvoiceAsync(draft.Id, expectedTotalAmount: draft.TotalAmount + 500m));

        Assert.Contains("Review the invoice and generate it again", ex.Message);
    }

    [Fact]
    public async Task P2B2_GenerateInvoiceAsync_MatchingExpectedTotal_Succeeds()
    {
        var (db, _, invoices, _, cust, veh, vend) = CreateTestEnvironment();
        var (card, _) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend);
        var draft = await invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(card.Id));

        var generated = await invoices.GenerateInvoiceAsync(draft.Id, expectedTotalAmount: draft.TotalAmount);

        Assert.NotNull(generated);
        Assert.Equal(InvoiceStatus.Generated, generated.Status);
        Assert.False(string.IsNullOrEmpty(generated.InvoiceNumber));
        Assert.Equal(draft.TotalAmount, generated.TotalAmount);
    }

    [Fact]
    public async Task P2B2_GenerateInvoiceAsync_OutsideJobCostChanged_WithoutEditDraft_ThrowsForbiddenException()
    {
        var (db, _, invoices, _, cust, veh, vend) = CreateTestEnvironment();
        var (card, job) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend, vendorCost: 2000m, status: OutsideJobStatus.Returned);

        // Draft invoice is created with outside job at ₹2,000
        var draft = await invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(card.Id));
        Assert.Contains(draft.Items, i => i.OutsideJobId == job.Id && i.UnitPrice == 2000m);

        // Vendor updates cost out-of-band to ₹3,500
        job.VendorCost = 3500m;
        await db.SaveChangesAsync();

        // Caller holding only invoices.generate (canEditDraft = false) attempts generation
        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            invoices.GenerateInvoiceAsync(draft.Id, expectedTotalAmount: draft.TotalAmount, canEditDraft: false));

        Assert.Contains("invoices.edit_draft", ex.Message);
    }

    [Fact]
    public async Task P2B2_GenerateInvoiceAsync_OutsideJobReturnedAfterDraft_WithoutEditDraft_ThrowsForbiddenException()
    {
        var (db, _, invoices, outsideJobs, cust, veh, vend) = CreateTestEnvironment();
        var (card, job) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend, vendorCost: 1500m, status: OutsideJobStatus.Outside);

        // Draft invoice created while job is still outside (not on draft)
        var draft = await invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(card.Id));
        Assert.DoesNotContain(draft.Items, i => i.OutsideJobId == job.Id);

        // Job returns later
        await outsideJobs.MarkReturnedAsync(job.Id, new MarkOutsideJobReturnedRequest(
            ReturnedAt: DateTime.UtcNow, VendorCost: 1500m, ReturnNotes: "Done"));

        // Caller without invoices.edit_draft cannot generate because it would mutate draft items
        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            invoices.GenerateInvoiceAsync(draft.Id, expectedTotalAmount: draft.TotalAmount, canEditDraft: false));

        Assert.Contains("invoices.edit_draft", ex.Message);
    }

    [Fact]
    public async Task P2B2_GenerateInvoiceAsync_OutsideJobCostChanged_WithEditDraft_StaleTotal_ThrowsConflictException()
    {
        var (db, _, invoices, _, cust, veh, vend) = CreateTestEnvironment();
        var (card, job) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend, vendorCost: 2000m, status: OutsideJobStatus.Returned);

        var draft = await invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(card.Id));
        var staleTotal = draft.TotalAmount;

        // Cost increases to 3000m
        job.VendorCost = 3000m;
        await db.SaveChangesAsync();

        // Caller has canEditDraft = true, but submits stale total -> 409 Conflict
        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            invoices.GenerateInvoiceAsync(draft.Id, expectedTotalAmount: staleTotal, canEditDraft: true));

        Assert.Contains("not the", ex.Message);
    }

    [Fact]
    public async Task P2B2_GenerateInvoiceAsync_OutsideJobCostChanged_WithEditDraft_ConfirmedTotal_Succeeds()
    {
        var (db, _, invoices, _, cust, veh, vend) = CreateTestEnvironment();
        var (card, job) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend, vendorCost: 2000m, status: OutsideJobStatus.Returned);

        var draft = await invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(card.Id));

        job.VendorCost = 3000m;
        await db.SaveChangesAsync();

        // Preview calculates authoritative updated total
        var preview = await invoices.PreviewAsync(draft.Id, new PreviewInvoiceRequest());

        // Caller has canEditDraft = true and passes confirmed updated total
        var generated = await invoices.GenerateInvoiceAsync(draft.Id, expectedTotalAmount: preview.TotalAmount, canEditDraft: true);

        Assert.NotNull(generated);
        Assert.Equal(InvoiceStatus.Generated, generated.Status);
        Assert.Equal(preview.TotalAmount, generated.TotalAmount);
        var item = Assert.Single(generated.Items, i => i.OutsideJobId == job.Id);
        Assert.Equal(3000m, item.UnitPrice);
    }

    [Fact]
    public async Task P2B2_PreviewAsync_MatchesGenerateInvoiceAsync_WithLateReturnedOutsideJob()
    {
        var (db, _, invoices, outsideJobs, cust, veh, vend) = CreateTestEnvironment();
        var (card, job) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend, vendorCost: 1500m, status: OutsideJobStatus.Outside);

        var draft = await invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(card.Id));

        await outsideJobs.MarkReturnedAsync(job.Id, new MarkOutsideJobReturnedRequest(
            ReturnedAt: DateTime.UtcNow, VendorCost: 1500m, ReturnNotes: "Ready"));

        var preview = await invoices.PreviewAsync(draft.Id, new PreviewInvoiceRequest());
        var generated = await invoices.GenerateInvoiceAsync(draft.Id, expectedTotalAmount: preview.TotalAmount, canEditDraft: true);

        Assert.Equal(preview.TotalAmount, generated.TotalAmount);
        Assert.Equal(preview.TaxableAmount, generated.TaxableAmount);
        Assert.Equal(preview.GstAmount, generated.GstAmount);
    }

    [Fact]
    public async Task P2B2_GenerateInvoiceAsync_NoOutsideJobChanges_WithoutEditDraft_Succeeds()
    {
        var (db, _, invoices, _, cust, veh, vend) = CreateTestEnvironment();
        var (card, _) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend, vendorCost: 1000m, status: OutsideJobStatus.Returned);

        // Draft invoice is created and already has outside job synchronized
        var draft = await invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(card.Id));

        // Caller has invoices.generate ONLY (canEditDraft = false). No draft lines changed -> succeeds!
        var generated = await invoices.GenerateInvoiceAsync(draft.Id, expectedTotalAmount: draft.TotalAmount, canEditDraft: false);

        Assert.NotNull(generated);
        Assert.Equal(InvoiceStatus.Generated, generated.Status);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CONTROLLER ACTION TESTS (HTTP STATUS CODES)
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task InvoicesController_Generate_NullBodyOrMissingExpectedTotal_ReturnsBadRequest400()
    {
        var (_, _, invoices, _, _, _, _) = CreateTestEnvironment();
        var env = new TestHostEnvironment();
        var auth = new FakeAuthService();
        var controller = new InvoicesController(invoices, auth, env);

        // 1. Null request
        var res1 = await controller.Generate(Guid.NewGuid(), null, CancellationToken.None);
        var bad1 = Assert.IsType<BadRequestObjectResult>(res1);
        Assert.Equal(StatusCodes.Status400BadRequest, bad1.StatusCode);

        // 2. Request with null ExpectedTotalAmount
        var res2 = await controller.Generate(Guid.NewGuid(), new GenerateInvoiceRequest(null), CancellationToken.None);
        var bad2 = Assert.IsType<BadRequestObjectResult>(res2);
        Assert.Equal(StatusCodes.Status400BadRequest, bad2.StatusCode);
    }

    [Fact]
    public async Task InvoicesController_Generate_MismatchedTotal_ReturnsConflict409()
    {
        var (db, _, invoices, _, cust, veh, vend) = CreateTestEnvironment();
        var (card, _) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend);
        var draft = await invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(card.Id));

        var env = new TestHostEnvironment();
        var auth = new FakeAuthService(canEditDraft: true);
        var controller = new InvoicesController(invoices, auth, env);

        var res = await controller.Generate(draft.Id, new GenerateInvoiceRequest(draft.TotalAmount + 500m), CancellationToken.None);
        var conf = Assert.IsType<ConflictObjectResult>(res);
        Assert.Equal(StatusCodes.Status409Conflict, conf.StatusCode);
    }

    [Fact]
    public async Task InvoicesController_Generate_DraftModificationWithoutEditDraft_ReturnsForbidden403()
    {
        var (db, _, invoices, outsideJobs, cust, veh, vend) = CreateTestEnvironment();
        var (card, job) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend, vendorCost: 1500m, status: OutsideJobStatus.Outside);
        var draft = await invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(card.Id));

        // Return the outside job to force draft modification
        await outsideJobs.MarkReturnedAsync(job.Id, new MarkOutsideJobReturnedRequest(
            ReturnedAt: DateTime.UtcNow, VendorCost: 1500m, ReturnNotes: "Done"));

        var env = new TestHostEnvironment();
        var auth = new FakeAuthService(canEditDraft: false); // Denied invoices.edit_draft
        var controller = new InvoicesController(invoices, auth, env);

        var res = await controller.Generate(draft.Id, new GenerateInvoiceRequest(draft.TotalAmount), CancellationToken.None);
        var objRes = Assert.IsType<ObjectResult>(res);
        Assert.Equal(StatusCodes.Status403Forbidden, objRes.StatusCode);
    }

    [Fact]
    public async Task JobCardsController_Get_WithoutOutsideJobsView_OmitsOutsideJobs()
    {
        var (db, jobCards, _, _, cust, veh, vend) = CreateTestEnvironment();
        var (card, _) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend, vendorCost: 2500m);

        var env = new TestHostEnvironment();
        var auth = new FakeAuthService(canViewOutsideJobs: false); // Denied outsidejobs.view
        var controller = new JobCardsController(jobCards, auth, env);

        var res = await controller.Get(card.Id, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(res);
        var dto = Assert.IsType<JobCardDto>(ok.Value);
        Assert.Null(dto.OutsideJobs);
    }

    [Fact]
    public async Task JobCardsController_Get_WithOutsideJobsView_IncludesOutsideJobs()
    {
        var (db, jobCards, _, _, cust, veh, vend) = CreateTestEnvironment();
        var (card, _) = await SeedJobCardWithOutsideJobAsync(db, cust, veh, vend, vendorCost: 2500m);

        var env = new TestHostEnvironment();
        var auth = new FakeAuthService(canViewOutsideJobs: true); // Granted outsidejobs.view
        var controller = new JobCardsController(jobCards, auth, env);

        var res = await controller.Get(card.Id, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(res);
        var dto = Assert.IsType<JobCardDto>(ok.Value);
        Assert.NotNull(dto.OutsideJobs);
        Assert.Single(dto.OutsideJobs);
        Assert.Equal(2500m, dto.OutsideJobs[0].VendorCost);
    }
}

/// <summary>
/// Host for RBAC Phase 2B end-to-end HTTP pipeline tests against live PostgreSQL.
/// </summary>
public sealed class RbacPhase2bHost : IAsyncLifetime
{
    private readonly PostgresTestDatabase _database = new();
    private WebApplicationFactory<AppDbContext>? _factory;

    public HttpClient Client { get; private set; } = null!;
    public IServiceProvider Services => _factory!.Services;
    public Dictionary<string, User> Users { get; } = new();
    public const string Password = "Valid-Pass123!";

    public async Task InitializeAsync()
    {
        if (PostgresTestEnvironment.AdminConnectionString is null) return;
        await _database.InitializeAsync();

        var jwtKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        var encryptionKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        _factory = new WebApplicationFactory<AppDbContext>().WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Testing");
            b.UseSetting("ConnectionStrings:DefaultConnection", _database.ConnectionString);
            b.UseSetting("Jwt:Key", jwtKey);
            b.UseSetting("WhatsApp:EncryptionKey", encryptionKey);
        });
        Client = _factory.CreateClient();

        using var scope = Services.CreateTestScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasherService>();
        var permissions = await db.Permissions.ToDictionaryAsync(p => p.Code);

        void Add(string username, UserRole role, params string[] codes)
        {
            var user = new User { FullName = username, Username = username, Role = role, IsActive = true };
            user.PasswordHash = hasher.HashPassword(user, Password);
            foreach (var code in codes)
                user.UserPermissions.Add(new UserPermission { UserId = user.Id, PermissionId = permissions[code].Id });
            db.Users.Add(user);
            Users[username] = user;
        }

        Add("owner", UserRole.Owner);
        Add("jobcards.viewer", UserRole.Staff, "jobcards.view");
        Add("jobcards.outside.viewer", UserRole.Staff, "jobcards.view", "outsidejobs.view");
        Add("invoices.generator", UserRole.Staff, "invoices.view", "invoices.generate");
        Add("invoices.generator.drafts", UserRole.Staff, "invoices.view", "invoices.generate", "invoices.edit_draft");
        await db.SaveChangesAsync();
    }

    public async Task<(Guid JobCardId, string JobCardNumber, Guid OutsideJobId, Guid? InvoiceId, decimal InvoiceTotal)>
        SeedScenarioAsync(bool jobReturned, bool withDraft)
    {
        using var scope = Services.CreateTestScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var suffix = Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
        var customer = new Customer { Name = $"Cust {suffix}", PhoneNumber = "9111111111" };
        var vehicle = new Vehicle { CustomerId = customer.Id, RegistrationNumber = $"TN07AB{suffix}", Make = "Honda", Model = "City" };
        var vendor = new Vendor { Name = $"Vendor {suffix}", Phone = "9222222222", IsActive = true };
        var service = new Service { Name = "Full Spa", Price = 1200m, TaxPercentage = 18m, IsActive = true };
        var jobCard = new JCard
        {
            JobCardNumber = $"JC-P2B-{suffix}",
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            Status = JobCardStatus.Draft,
            Subtotal = 1200m,
            TotalAmount = 1416m,
        };
        jobCard.JobCardServices.Add(new JCardSvc
        {
            JobCardId = jobCard.Id,
            ServiceId = service.Id,
            ServiceName = service.Name,
            UnitPrice = 1200m,
            Quantity = 1,
            TaxPercentage = 18m,
            LineTotal = 1416m,
        });

        var outsideJob = new OutsideJob
        {
            JobCardId = jobCard.Id,
            CustomerId = customer.Id,
            VehicleId = vehicle.Id,
            VendorId = vendor.Id,
            ServiceName = "Wheel Alignment",
            Status = jobReturned ? OutsideJobStatus.Returned : OutsideJobStatus.Outside,
            SentAt = DateTime.UtcNow.AddDays(-1),
            ExpectedReturnAt = DateTime.UtcNow.AddDays(1),
            ReturnedAt = jobReturned ? DateTime.UtcNow : null,
            VendorCost = 800m,
        };

        db.AddRange(customer, vehicle, vendor, service, jobCard, outsideJob);
        await db.SaveChangesAsync();

        Guid? invoiceId = null;
        decimal total = 1416m;
        if (withDraft)
        {
            var invoiceService = scope.ServiceProvider.GetRequiredService<IInvoiceService>();
            var draft = await invoiceService.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
            invoiceId = draft.Id;
            total = draft.TotalAmount;
        }

        return (jobCard.Id, jobCard.JobCardNumber, outsideJob.Id, invoiceId, total);
    }

    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, string asUser, object? body = null)
    {
        var options = Services.GetRequiredService<IOptions<JwtOptions>>().Value;
        var user = Users[asUser];
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), new Claim(JwtTokenService.OrganizationClaim, DefaultOrganization.Id.ToString()),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("isOwner", (user.Role == UserRole.Owner).ToString().ToLowerInvariant()),
        };
        var token = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(options.Issuer, options.Audience, claims,
            notBefore: DateTime.UtcNow.AddMinutes(-1), expires: DateTime.UtcNow.AddMinutes(10),
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Key)), SecurityAlgorithms.HmacSha256)));

        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) request.Content = JsonContent.Create(body);
        return await Client.SendAsync(request);
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null) await _factory.DisposeAsync();
        await _database.DisposeAsync();
    }
}

public class RbacPhase2bHttpTests : IClassFixture<RbacPhase2bHost>
{
    private readonly RbacPhase2bHost _api;
    public RbacPhase2bHttpTests(RbacPhase2bHost api) => _api = api;

    [PostgresFact]
    public async Task Http_JobCardDetail_WithoutOutsideJobsView_OmitsOutsideJobsAndVendorCost()
    {
        var (cardId, cardNumber, _, _, _) = await _api.SeedScenarioAsync(jobReturned: true, withDraft: false);

        // 1. GET /api/job-cards/{id} as jobcards.viewer (jobcards.view only)
        var res1 = await _api.SendAsync(HttpMethod.Get, $"/api/job-cards/{cardId}", "jobcards.viewer");
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);
        var json1 = await res1.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(json1.TryGetProperty("outsideJobs", out var oj1) && oj1.ValueKind == JsonValueKind.Array && oj1.GetArrayLength() > 0);

        // 2. GET /api/job-cards/by-number/{number} as jobcards.viewer
        var res2 = await _api.SendAsync(HttpMethod.Get, $"/api/job-cards/by-number/{cardNumber}", "jobcards.viewer");
        Assert.Equal(HttpStatusCode.OK, res2.StatusCode);
        var json2 = await res2.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(json2.TryGetProperty("outsideJobs", out var oj2) && oj2.ValueKind == JsonValueKind.Array && oj2.GetArrayLength() > 0);

        // 3. GET /api/job-cards/{id} as jobcards.outside.viewer -> outsideJobs populated with vendorCost
        var res3 = await _api.SendAsync(HttpMethod.Get, $"/api/job-cards/{cardId}", "jobcards.outside.viewer");
        Assert.Equal(HttpStatusCode.OK, res3.StatusCode);
        var json3 = await res3.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json3.TryGetProperty("outsideJobs", out var oj3) && oj3.ValueKind == JsonValueKind.Array && oj3.GetArrayLength() > 0);
        var firstOj = oj3[0];
        Assert.Equal(800m, firstOj.GetProperty("vendorCost").GetDecimal());
    }

    [PostgresFact]
    public async Task Http_GenerateInvoice_ValidatesMandatoryExpectedTotalAmount()
    {
        var (_, _, _, invoiceId, total) = await _api.SeedScenarioAsync(jobReturned: false, withDraft: true);

        // 1. Missing body -> 400
        var resNull = await _api.SendAsync(HttpMethod.Post, $"/api/invoices/{invoiceId}/generate", "invoices.generator", null);
        Assert.Equal(HttpStatusCode.BadRequest, resNull.StatusCode);

        // 2. Body with null expectedTotalAmount -> 400
        var resNullProp = await _api.SendAsync(HttpMethod.Post, $"/api/invoices/{invoiceId}/generate", "invoices.generator", new { expectedTotalAmount = (decimal?)null });
        Assert.Equal(HttpStatusCode.BadRequest, resNullProp.StatusCode);

        // 3. Body with empty object -> 400
        var resEmpty = await _api.SendAsync(HttpMethod.Post, $"/api/invoices/{invoiceId}/generate", "invoices.generator", new { });
        Assert.Equal(HttpStatusCode.BadRequest, resEmpty.StatusCode);

        // 4. Mismatched total -> 409
        var resMismatch = await _api.SendAsync(HttpMethod.Post, $"/api/invoices/{invoiceId}/generate", "invoices.generator", new { expectedTotalAmount = total + 100m });
        Assert.Equal(HttpStatusCode.Conflict, resMismatch.StatusCode);

        // 5. Correct total -> 200
        var resOk = await _api.SendAsync(HttpMethod.Post, $"/api/invoices/{invoiceId}/generate", "invoices.generator", new { expectedTotalAmount = total });
        Assert.Equal(HttpStatusCode.OK, resOk.StatusCode);
    }

    [PostgresFact]
    public async Task Http_GenerateInvoice_DraftRequiresModification_EnforcesEditDraftPermission()
    {
        // Outside job was outside when draft was created -> not on draft
        var (cardId, _, jobId, invoiceId, originalTotal) = await _api.SeedScenarioAsync(jobReturned: false, withDraft: true);

        // Return the outside job so the draft now requires modification
        using (var scope = _api.Services.CreateTestScope())
        {
            var ojService = scope.ServiceProvider.GetRequiredService<IOutsideJobService>();
            await ojService.MarkReturnedAsync(jobId, new MarkOutsideJobReturnedRequest(
                ReturnedAt: DateTime.UtcNow, VendorCost: 800m, ReturnNotes: "Finished"));
        }

        // 1. Caller with invoices.generate but WITHOUT invoices.edit_draft -> 403 Forbidden
        var resForbidden = await _api.SendAsync(HttpMethod.Post, $"/api/invoices/{invoiceId}/generate", "invoices.generator",
            new { expectedTotalAmount = originalTotal });
        Assert.Equal(HttpStatusCode.Forbidden, resForbidden.StatusCode);

        // 2. Caller WITH invoices.edit_draft -> previews updated total and generates successfully (200)
        decimal updatedTotal;
        using (var scope = _api.Services.CreateTestScope())
        {
            var invService = scope.ServiceProvider.GetRequiredService<IInvoiceService>();
            var preview = await invService.PreviewAsync(invoiceId!.Value, new PreviewInvoiceRequest());
            updatedTotal = preview.TotalAmount;
        }

        var resSuccess = await _api.SendAsync(HttpMethod.Post, $"/api/invoices/{invoiceId}/generate", "invoices.generator.drafts",
            new { expectedTotalAmount = updatedTotal });
        Assert.Equal(HttpStatusCode.OK, resSuccess.StatusCode);
    }
}
