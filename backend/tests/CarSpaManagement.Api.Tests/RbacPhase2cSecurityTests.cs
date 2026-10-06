using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Reflection;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Reports;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// RBAC Phase 2C focused security test suite:
/// P2C-1 — Outside Jobs report security: requires outsidejobs.view (not reports.view).
/// P2C-2 — Monthly Billing report security: requires reports.invoices (not reports.view).
/// P2C-3 — Dashboard field-level authorization: base reports.view, granular redaction of sensitive sections.
/// </summary>
public class RbacPhase2cSecurityTests
{
    private class FakeAuthService : IAuthorizationService
    {
        private readonly HashSet<string> _grantedPolicies;

        public FakeAuthService(params string[] grantedPolicies)
        {
            _grantedPolicies = new HashSet<string>(grantedPolicies, StringComparer.OrdinalIgnoreCase);
        }

        public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, IEnumerable<IAuthorizationRequirement> requirements) =>
            Task.FromResult(AuthorizationResult.Success());

        public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user, object? resource, string policyName)
        {
            return Task.FromResult(_grantedPolicies.Contains(policyName) ? AuthorizationResult.Success() : AuthorizationResult.Failed());
        }
    }

    private static async Task<(AppDbContext Db, ReportService Reports, Customer Cust, Vehicle Veh, Showroom Showroom, Staff StaffMember)>
        CreateInMemoryTestEnvironmentAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var db = new AppDbContext(options);
        var reports = new ReportService(db);

        var cust = new Customer { Name = "P2C Customer", PhoneNumber = "9888877777" };
        var veh = new Vehicle { CustomerId = cust.Id, RegistrationNumber = "TN01P2C001", Make = "Hyundai", Model = "Verna" };
        var showroom = new Showroom { MasterId = "SH00001", Name = "Main Showroom", Address = "City Center", Phone = "9876543210", IsActive = true };
        var staff = new Staff { StaffMasterId = "ST001A", Name = "John Mechanic", PhoneNumber = "9123456789", IsActive = true };

        db.AddRange(cust, veh, showroom, staff);
        await db.SaveChangesAsync();

        return (db, reports, cust, veh, showroom, staff);
    }

    private static async Task SeedDashboardDataAsync(AppDbContext db, Customer cust, Vehicle veh, Showroom showroom, Staff staff)
    {
        var now = DateTime.UtcNow;

        // JobCard with completed service
        var jc = new JobCard
        {
            JobCardNumber = "JC-P2C-001",
            CustomerId = cust.Id,
            VehicleId = veh.Id,
            Status = JobCardStatus.Invoiced,
            Subtotal = 2000m,
            TotalAmount = 2360m,
            CreatedAt = now,
        };
        var service = new Service { Name = "Ceramic Wash", Price = 2000m, TaxPercentage = 18m, IsActive = true };
        jc.JobCardServices.Add(new Domain.Entities.JobCardService
        {
            JobCardId = jc.Id,
            ServiceId = service.Id,
            ServiceName = service.Name,
            UnitPrice = 2000m,
            Quantity = 1,
            TaxPercentage = 18m,
            LineTotal = 2360m,
        });

        // Invoice
        var invoice = new Invoice
        {
            InvoiceNumber = "INV-P2C-001",
            JobCardId = jc.Id,
            CustomerId = cust.Id,
            VehicleId = veh.Id,
            InvoiceDate = now.Date,
            Subtotal = 2000m,
            TaxableAmount = 2000m,
            GstAmount = 360m,
            TotalAmount = 2360m,
            PaidAmount = 2360m,
            BalanceAmount = 0m,
            Status = InvoiceStatus.Paid,
            CreatedAt = now,
        };

        // Payment
        var payment = new Payment
        {
            InvoiceId = invoice.Id,
            Amount = 2360m,
            PaymentMethod = PaymentMethod.UPI,
            Reference = "UPI-REF-001",
            PaymentDate = now,
        };

        // Showroom bill
        var sBill = new ShowroomDailyBill
        {
            ShowroomId = showroom.Id,
            Date = now.Date,
            Amount = 5000m,
            Notes = "Daily Wash Batch",
        };

        // Staff Advance
        var advance = new StaffAdvance
        {
            StaffId = staff.Id,
            Amount = 1500m,
            AdvanceDate = now.Date,
            Reason = "Emergency",
            Status = StaffAdvanceStatus.Outstanding,
            BalanceAmount = 1500m,
        };

        db.AddRange(service, jc, invoice, payment, sBill, advance);
        await db.SaveChangesAsync();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // P2C-3: SERVICE-LEVEL FIELD REDACTION TESTS
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task ReportService_GetDashboardSummaryAsync_AllDenied_RedactsAllSensitiveFinancialSections()
    {
        var (db, reports, cust, veh, showroom, staff) = await CreateInMemoryTestEnvironmentAsync();
        await SeedDashboardDataAsync(db, cust, veh, showroom, staff);

        var summary = await reports.GetDashboardSummaryAsync(
            fromDate: null,
            toDate: null,
            canViewSales: false,
            canViewPayments: false,
            canViewInvoices: false,
            canViewShowrooms: false,
            canViewStaffAdvances: false);

        // Sensitive sections MUST be null or empty list (not zero-valued)
        Assert.Null(summary.Sales);
        Assert.Null(summary.PaymentCollection);
        Assert.Null(summary.Showroom);
        Assert.Null(summary.StaffAdvances);
        Assert.Empty(summary.RecentAdvances ?? new());
        Assert.Empty(summary.TopServices ?? new());
        Assert.Empty(summary.RevenueTimeline ?? new());

        // Outstanding financial section completely redacted
        Assert.Null(summary.Outstanding);

        // Operational metrics MUST be preserved
        Assert.NotNull(summary.JobCardKpis);
        Assert.True(summary.JobCardKpis.TotalJobCards > 0);
        Assert.NotNull(summary.VehicleActivity);
        Assert.True(summary.VehicleActivity.VehiclesServiced > 0);
    }

    [Fact]
    public async Task ReportService_GetDashboardSummaryAsync_SalesOnly_ExposesOnlySalesAndTimeline()
    {
        var (db, reports, cust, veh, showroom, staff) = await CreateInMemoryTestEnvironmentAsync();
        await SeedDashboardDataAsync(db, cust, veh, showroom, staff);

        var summary = await reports.GetDashboardSummaryAsync(
            fromDate: null,
            toDate: null,
            canViewSales: true,
            canViewPayments: false,
            canViewInvoices: false,
            canViewShowrooms: false,
            canViewStaffAdvances: false);

        Assert.NotNull(summary.Sales);
        Assert.Equal(2360m, summary.Sales.NetSales);
        Assert.NotEmpty(summary.RevenueTimeline ?? new());
        Assert.NotEmpty(summary.TopServices ?? new());

        // Other sensitive sections remain redacted
        Assert.Null(summary.PaymentCollection);
        Assert.Null(summary.Showroom);
        Assert.Null(summary.StaffAdvances);
        Assert.Empty(summary.RecentAdvances ?? new());
    }

    [Fact]
    public async Task ReportService_GetDashboardSummaryAsync_PaymentsOnly_ExposesOnlyPaymentCollection()
    {
        var (db, reports, cust, veh, showroom, staff) = await CreateInMemoryTestEnvironmentAsync();
        await SeedDashboardDataAsync(db, cust, veh, showroom, staff);

        var summary = await reports.GetDashboardSummaryAsync(
            fromDate: null,
            toDate: null,
            canViewSales: false,
            canViewPayments: true,
            canViewInvoices: false,
            canViewShowrooms: false,
            canViewStaffAdvances: false);

        Assert.NotNull(summary.PaymentCollection);
        Assert.Equal(2360m, summary.PaymentCollection.TotalReceived);

        // Outstanding and other sensitive sections remain redacted
        Assert.Null(summary.Outstanding);
        Assert.Null(summary.Sales);
        Assert.Null(summary.Showroom);
        Assert.Null(summary.StaffAdvances);
        Assert.Empty(summary.RecentAdvances ?? new());
    }

    [Fact]
    public async Task ReportService_GetDashboardSummaryAsync_InvoicesOnly_ExposesInvoiceKpisAndOutstanding()
    {
        var (db, reports, cust, veh, showroom, staff) = await CreateInMemoryTestEnvironmentAsync();
        await SeedDashboardDataAsync(db, cust, veh, showroom, staff);

        var summary = await reports.GetDashboardSummaryAsync(
            fromDate: null,
            toDate: null,
            canViewSales: false,
            canViewPayments: false,
            canViewInvoices: true,
            canViewShowrooms: false,
            canViewStaffAdvances: false);

        Assert.NotNull(summary.InvoiceKpis);
        Assert.NotNull(summary.Outstanding);
        Assert.NotNull(summary.Outstanding.TotalOutstandingCombined);

        // Sales and other sections remain redacted
        Assert.Null(summary.Sales);
        Assert.Null(summary.PaymentCollection);
        Assert.Null(summary.Showroom);
        Assert.Null(summary.StaffAdvances);
    }

    [Fact]
    public async Task ReportService_GetDashboardSummaryAsync_ShowroomsOnly_ExposesOnlyShowroomSection()
    {
        var (db, reports, cust, veh, showroom, staff) = await CreateInMemoryTestEnvironmentAsync();
        await SeedDashboardDataAsync(db, cust, veh, showroom, staff);

        var summary = await reports.GetDashboardSummaryAsync(
            fromDate: null,
            toDate: null,
            canViewSales: false,
            canViewPayments: false,
            canViewInvoices: false,
            canViewShowrooms: true,
            canViewStaffAdvances: false);

        Assert.NotNull(summary.Showroom);
        Assert.True(summary.Showroom.ActiveShowroomsCount > 0);

        // Other sensitive sections remain redacted
        Assert.Null(summary.Sales);
        Assert.Null(summary.PaymentCollection);
        Assert.Null(summary.StaffAdvances);
        Assert.Empty(summary.RecentAdvances ?? new());
    }

    [Fact]
    public async Task ReportService_GetDashboardSummaryAsync_StaffAdvancesOnly_ExposesOnlyAdvancesAndRecentAdvances()
    {
        var (db, reports, cust, veh, showroom, staff) = await CreateInMemoryTestEnvironmentAsync();
        await SeedDashboardDataAsync(db, cust, veh, showroom, staff);

        var summary = await reports.GetDashboardSummaryAsync(
            fromDate: null,
            toDate: null,
            canViewSales: false,
            canViewPayments: false,
            canViewInvoices: false,
            canViewShowrooms: false,
            canViewStaffAdvances: true);

        Assert.NotNull(summary.StaffAdvances);
        Assert.Equal(1500m, summary.StaffAdvances.OutstandingAmount);
        Assert.NotEmpty(summary.RecentAdvances ?? new());

        // Other sensitive sections remain redacted
        Assert.Null(summary.Sales);
        Assert.Null(summary.PaymentCollection);
        Assert.Null(summary.Showroom);
    }

    [Fact]
    public async Task ReportService_GetDashboardSummaryAsync_AllAllowed_PopulatesAllSections()
    {
        var (db, reports, cust, veh, showroom, staff) = await CreateInMemoryTestEnvironmentAsync();
        await SeedDashboardDataAsync(db, cust, veh, showroom, staff);

        // Default arguments are all true
        var summary = await reports.GetDashboardSummaryAsync();

        Assert.NotNull(summary.Sales);
        Assert.NotNull(summary.PaymentCollection);
        Assert.NotNull(summary.Showroom);
        Assert.NotNull(summary.StaffAdvances);
        Assert.NotEmpty(summary.RecentAdvances ?? new());
        Assert.NotEmpty(summary.TopServices ?? new());
        Assert.NotEmpty(summary.RevenueTimeline ?? new());
        Assert.NotNull(summary.Outstanding);
        Assert.NotNull(summary.Outstanding.TotalOutstandingCombined);
        Assert.NotNull(summary.JobCardKpis);
        Assert.NotNull(summary.VehicleActivity);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PERMISSION ATTRIBUTE REFLECTION TESTS
    // ══════════════════════════════════════════════════════════════════════════

    [Theory]
    [InlineData(nameof(ReportsController.GetOutsideJobsReport), "outsidejobs.view")]
    [InlineData(nameof(ReportsController.GetMonthlyBillingReport), "reports.invoices")]
    [InlineData(nameof(ReportsController.GetDashboardSummary), "reports.view")]
    [InlineData(nameof(ReportsController.GetSalesReport), "reports.sales")]
    [InlineData(nameof(ReportsController.GetPaymentCollectionReport), "reports.payments")]
    [InlineData(nameof(ReportsController.GetOutstandingInvoicesReport), "reports.invoices")]
    [InlineData(nameof(ReportsController.GetGstReport), "reports.gst")]
    [InlineData(nameof(ReportsController.GetJobCardReport), "reports.job_cards")]
    [InlineData(nameof(ReportsController.GetShowroomReport), "reports.showrooms")]
    [InlineData(nameof(ReportsController.GetStaffProductivityReport), "reports.staff_productivity")]
    [InlineData(nameof(ReportsController.GetStaffAdvancesReport), "reports.staff_advances")]
    public void ReportsController_Endpoints_EnforceExactRequiredPermissionAttributes(string methodName, string expectedPermission)
    {
        var method = typeof(ReportsController).GetMethod(methodName);
        Assert.NotNull(method);

        var attr = method.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(attr);
        Assert.Equal($"Permission:{expectedPermission}", attr.Policy);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CONTROLLER UNIT TEST WITH FAKE AUTHORIZATION SERVICE
    // ══════════════════════════════════════════════════════════════════════════

    [Fact]
    public async Task ReportsController_Dashboard_RedactsSectionsViaAuthorizationService()
    {
        var (db, reports, cust, veh, showroom, staff) = await CreateInMemoryTestEnvironmentAsync();
        await SeedDashboardDataAsync(db, cust, veh, showroom, staff);

        // Fake authorization service granting ONLY Permission:reports.sales
        var authService = new FakeAuthService("Permission:reports.sales");
        var controller = new ReportsController(reports, authService);

        var result = await controller.GetDashboardSummary();
        var ok = Assert.IsType<OkObjectResult>(result);
        var summary = Assert.IsType<DashboardSummaryDto>(ok.Value);

        Assert.NotNull(summary.Sales);
        Assert.Null(summary.PaymentCollection);
        Assert.Null(summary.Showroom);
        Assert.Null(summary.StaffAdvances);
    }
}

/// <summary>
/// Host for RBAC Phase 2C end-to-end HTTP pipeline tests against live PostgreSQL.
/// </summary>
public sealed class RbacPhase2cHost : IAsyncLifetime
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

        using var scope = Services.CreateScope();
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
        Add("reports.viewer", UserRole.Staff, "reports.view");
        Add("outsidejobs.viewer", UserRole.Staff, "outsidejobs.view");
        Add("outsidejobs.reports.viewer", UserRole.Staff, "reports.view", "outsidejobs.view");
        Add("billing.viewer", UserRole.Staff, "reports.invoices");
        Add("billing.reports.viewer", UserRole.Staff, "reports.view", "reports.invoices");
        Add("sales.viewer", UserRole.Staff, "reports.view", "reports.sales");
        Add("payments.viewer", UserRole.Staff, "reports.view", "reports.payments");
        Add("showrooms.viewer", UserRole.Staff, "reports.view", "reports.showrooms");
        Add("advances.viewer", UserRole.Staff, "reports.view", "reports.staff_advances");
        Add("no.permissions", UserRole.Staff);
        await db.SaveChangesAsync();

        // Seed data for live endpoints
        await SeedDatabaseDataAsync(db);
    }

    private static async Task SeedDatabaseDataAsync(AppDbContext db)
    {
        var now = DateTime.UtcNow;
        var cust = new Customer { Name = "Pg Customer", PhoneNumber = "9876501234" };
        var veh = new Vehicle { CustomerId = cust.Id, RegistrationNumber = "TN09PG001", Make = "Toyota", Model = "Innova" };
        var vend = new Vendor { Name = "Pg Paint Shop", Phone = "9876509999", IsActive = true };
        var service = new Service { Name = "Deep Cleaning", Price = 3000m, TaxPercentage = 18m, IsActive = true };

        var jc = new JobCard
        {
            JobCardNumber = "JC-PG-001",
            CustomerId = cust.Id,
            VehicleId = veh.Id,
            Status = JobCardStatus.Invoiced,
            Subtotal = 3000m,
            TotalAmount = 3540m,
            CreatedAt = now,
        };
        jc.JobCardServices.Add(new Domain.Entities.JobCardService
        {
            JobCardId = jc.Id,
            ServiceId = service.Id,
            ServiceName = service.Name,
            UnitPrice = 3000m,
            Quantity = 1,
            TaxPercentage = 18m,
            LineTotal = 3540m,
        });

        var outsideJob = new OutsideJob
        {
            JobCardId = jc.Id,
            CustomerId = cust.Id,
            VehicleId = veh.Id,
            VendorId = vend.Id,
            ServiceName = "Bumper Repair",
            Status = OutsideJobStatus.Returned,
            SentAt = now.AddDays(-1),
            ExpectedReturnAt = now,
            ReturnedAt = now,
            VendorCost = 1500m,
        };

        var invoice = new Invoice
        {
            InvoiceNumber = "INV-PG-001",
            JobCardId = jc.Id,
            CustomerId = cust.Id,
            VehicleId = veh.Id,
            InvoiceDate = now.Date,
            Subtotal = 3000m,
            TaxableAmount = 3000m,
            GstAmount = 540m,
            TotalAmount = 3540m,
            PaidAmount = 3540m,
            BalanceAmount = 0m,
            Status = InvoiceStatus.Paid,
            CreatedAt = now,
        };

        var payment = new Payment
        {
            InvoiceId = invoice.Id,
            Amount = 3540m,
            PaymentMethod = PaymentMethod.UPI,
            Reference = "PG-UPI-001",
            PaymentDate = now,
        };

        var staff = new Staff { StaffMasterId = "ST002B", Name = "Pg Technician", PhoneNumber = "9988112233", IsActive = true };
        var advance = new StaffAdvance
        {
            StaffId = staff.Id,
            Amount = 2000m,
            AdvanceDate = now.Date,
            Reason = "Medical",
            Status = StaffAdvanceStatus.Outstanding,
            BalanceAmount = 2000m,
        };

        var showroom = new Showroom { MasterId = "SH00002", Name = "Pg Dealer", Address = "Highway", Phone = "9112233445", IsActive = true };
        var showroomBill = new ShowroomDailyBill
        {
            ShowroomId = showroom.Id,
            Date = now.Date,
            Amount = 7000m,
            Notes = "Monthly contract wash",
        };

        db.AddRange(cust, veh, vend, service, jc, outsideJob, invoice, payment, staff, advance, showroom, showroomBill);
        await db.SaveChangesAsync();
    }

    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, string asUser, object? body = null)
    {
        var options = Services.GetRequiredService<IOptions<JwtOptions>>().Value;
        var user = Users[asUser];
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
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

public class RbacPhase2cHttpTests : IClassFixture<RbacPhase2cHost>
{
    private readonly RbacPhase2cHost _api;
    public RbacPhase2cHttpTests(RbacPhase2cHost api) => _api = api;

    // ══════════════════════════════════════════════════════════════════════════
    // P2C-1: OUTSIDE JOBS REPORT PERMISSION ISOLATION (HTTP PIPELINE)
    // ══════════════════════════════════════════════════════════════════════════

    [PostgresFact]
    public async Task Http_OutsideJobsReport_LackingOutsideJobsView_ReturnsForbidden403()
    {
        // 1. User with reports.view only (lacks outsidejobs.view) -> 403 Forbidden
        var res1 = await _api.SendAsync(HttpMethod.Get, "/api/reports/outside-jobs", "reports.viewer");
        Assert.Equal(HttpStatusCode.Forbidden, res1.StatusCode);

        // 2. User with no permissions -> 403 Forbidden
        var res2 = await _api.SendAsync(HttpMethod.Get, "/api/reports/outside-jobs", "no.permissions");
        Assert.Equal(HttpStatusCode.Forbidden, res2.StatusCode);
    }

    [PostgresFact]
    public async Task Http_OutsideJobsReport_WithOutsideJobsView_ReturnsOk200()
    {
        // 1. User with outsidejobs.view only -> 200 OK
        var res1 = await _api.SendAsync(HttpMethod.Get, "/api/reports/outside-jobs", "outsidejobs.viewer");
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);
        var json1 = await res1.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json1.TryGetProperty("vendorSummary", out _) || json1.TryGetProperty("history", out _));

        // 2. User with reports.view + outsidejobs.view -> 200 OK
        var res2 = await _api.SendAsync(HttpMethod.Get, "/api/reports/outside-jobs", "outsidejobs.reports.viewer");
        Assert.Equal(HttpStatusCode.OK, res2.StatusCode);

        // 3. Owner -> 200 OK
        var res3 = await _api.SendAsync(HttpMethod.Get, "/api/reports/outside-jobs", "owner");
        Assert.Equal(HttpStatusCode.OK, res3.StatusCode);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // P2C-2: MONTHLY BILLING REPORT PERMISSION ISOLATION (HTTP PIPELINE)
    // ══════════════════════════════════════════════════════════════════════════

    [PostgresFact]
    public async Task Http_MonthlyBillingReport_LackingReportsInvoices_ReturnsForbidden403()
    {
        var now = DateTime.UtcNow;
        var url = $"/api/reports/billing/monthly?year={now.Year}&month={now.Month}";

        // 1. User with reports.view only (lacks reports.invoices) -> 403 Forbidden
        var res1 = await _api.SendAsync(HttpMethod.Get, url, "reports.viewer");
        Assert.Equal(HttpStatusCode.Forbidden, res1.StatusCode);

        // 2. User with no permissions -> 403 Forbidden
        var res2 = await _api.SendAsync(HttpMethod.Get, url, "no.permissions");
        Assert.Equal(HttpStatusCode.Forbidden, res2.StatusCode);
    }

    [PostgresFact]
    public async Task Http_MonthlyBillingReport_WithReportsInvoices_ReturnsOk200()
    {
        var now = DateTime.UtcNow;
        var url = $"/api/reports/billing/monthly?year={now.Year}&month={now.Month}";

        // 1. User with reports.invoices only -> 200 OK
        var res1 = await _api.SendAsync(HttpMethod.Get, url, "billing.viewer");
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);
        var json1 = await res1.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json1.TryGetProperty("dailySheets", out _));

        // 2. User with reports.view + reports.invoices -> 200 OK
        var res2 = await _api.SendAsync(HttpMethod.Get, url, "billing.reports.viewer");
        Assert.Equal(HttpStatusCode.OK, res2.StatusCode);

        // 3. Owner -> 200 OK
        var res3 = await _api.SendAsync(HttpMethod.Get, url, "owner");
        Assert.Equal(HttpStatusCode.OK, res3.StatusCode);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // P2C-3: DASHBOARD FIELD-LEVEL AUTHORIZATION (HTTP PIPELINE)
    // ══════════════════════════════════════════════════════════════════════════

    [PostgresFact]
    public async Task Http_Dashboard_LackingBaseReportsView_ReturnsForbidden403()
    {
        // 1. User with no permissions -> 403 Forbidden
        var res1 = await _api.SendAsync(HttpMethod.Get, "/api/reports/dashboard", "no.permissions");
        Assert.Equal(HttpStatusCode.Forbidden, res1.StatusCode);

        // 2. User with outsidejobs.view only (lacks base reports.view) -> 403 Forbidden
        var res2 = await _api.SendAsync(HttpMethod.Get, "/api/reports/dashboard", "outsidejobs.viewer");
        Assert.Equal(HttpStatusCode.Forbidden, res2.StatusCode);
    }

    [PostgresFact]
    public async Task Http_Dashboard_WithReportsViewOnly_RedactsSensitiveFinancialSections()
    {
        var res = await _api.SendAsync(HttpMethod.Get, "/api/reports/dashboard", "reports.viewer");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var json = await res.Content.ReadFromJsonAsync<JsonElement>();

        // Operational metrics preserved
        Assert.True(json.TryGetProperty("jobCardKpis", out var jcKpis) && jcKpis.ValueKind != JsonValueKind.Null);
        Assert.True(json.TryGetProperty("vehicleActivity", out var vehAct) && vehAct.ValueKind != JsonValueKind.Null);

        // Financial sections redacted as null
        Assert.True(json.TryGetProperty("sales", out var sales) && sales.ValueKind == JsonValueKind.Null);
        Assert.True(json.TryGetProperty("paymentCollection", out var payments) && payments.ValueKind == JsonValueKind.Null);
        Assert.True(json.TryGetProperty("showroom", out var showroom) && showroom.ValueKind == JsonValueKind.Null);
        Assert.True(json.TryGetProperty("staffAdvances", out var staffAdv) && staffAdv.ValueKind == JsonValueKind.Null);

        // Sensitive collections are null or empty arrays
        Assert.True(!json.TryGetProperty("recentAdvances", out var recAdv) || recAdv.ValueKind == JsonValueKind.Null || recAdv.GetArrayLength() == 0);
        Assert.True(!json.TryGetProperty("topServices", out var topSvc) || topSvc.ValueKind == JsonValueKind.Null || topSvc.GetArrayLength() == 0);
        Assert.True(!json.TryGetProperty("revenueTimeline", out var revTime) || revTime.ValueKind == JsonValueKind.Null || revTime.GetArrayLength() == 0);

        // Outstanding is null or contains null totals
        Assert.True(json.TryGetProperty("outstanding", out var outstanding) &&
            (outstanding.ValueKind == JsonValueKind.Null ||
             (outstanding.TryGetProperty("totalOutstandingCombined", out var totalOut) && totalOut.ValueKind == JsonValueKind.Null)));
    }

    [PostgresFact]
    public async Task Http_Dashboard_WithSalesPermission_ExposesOnlySalesSection()
    {
        var res = await _api.SendAsync(HttpMethod.Get, "/api/reports/dashboard", "sales.viewer");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var json = await res.Content.ReadFromJsonAsync<JsonElement>();

        // Sales section populated
        Assert.True(json.TryGetProperty("sales", out var sales) && sales.ValueKind != JsonValueKind.Null);
        Assert.True(sales.GetProperty("netSales").GetDecimal() > 0);

        // Other financial sections remain redacted
        Assert.True(json.TryGetProperty("paymentCollection", out var payments) && payments.ValueKind == JsonValueKind.Null);
        Assert.True(json.TryGetProperty("showroom", out var showroom) && showroom.ValueKind == JsonValueKind.Null);
        Assert.True(json.TryGetProperty("staffAdvances", out var staffAdv) && staffAdv.ValueKind == JsonValueKind.Null);
    }

    [PostgresFact]
    public async Task Http_Dashboard_WithPaymentsPermission_ExposesOnlyPaymentCollection()
    {
        var res = await _api.SendAsync(HttpMethod.Get, "/api/reports/dashboard", "payments.viewer");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var json = await res.Content.ReadFromJsonAsync<JsonElement>();

        // Payment collection section populated
        Assert.True(json.TryGetProperty("paymentCollection", out var payments) && payments.ValueKind != JsonValueKind.Null);
        Assert.True(payments.GetProperty("totalReceived").GetDecimal() > 0);

        // Other financial sections remain redacted
        Assert.True(json.TryGetProperty("sales", out var sales) && sales.ValueKind == JsonValueKind.Null);
        Assert.True(json.TryGetProperty("showroom", out var showroom) && showroom.ValueKind == JsonValueKind.Null);
        Assert.True(json.TryGetProperty("staffAdvances", out var staffAdv) && staffAdv.ValueKind == JsonValueKind.Null);
    }

    [PostgresFact]
    public async Task Http_Dashboard_WithShowroomsPermission_ExposesOnlyShowroomSection()
    {
        var res = await _api.SendAsync(HttpMethod.Get, "/api/reports/dashboard", "showrooms.viewer");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var json = await res.Content.ReadFromJsonAsync<JsonElement>();

        // Showroom section populated
        Assert.True(json.TryGetProperty("showroom", out var showroom) && showroom.ValueKind != JsonValueKind.Null);
        Assert.True(showroom.GetProperty("activeShowroomsCount").GetInt32() > 0);

        // Other financial sections remain redacted
        Assert.True(json.TryGetProperty("sales", out var sales) && sales.ValueKind == JsonValueKind.Null);
        Assert.True(json.TryGetProperty("paymentCollection", out var payments) && payments.ValueKind == JsonValueKind.Null);
        Assert.True(json.TryGetProperty("staffAdvances", out var staffAdv) && staffAdv.ValueKind == JsonValueKind.Null);
    }

    [PostgresFact]
    public async Task Http_Dashboard_WithStaffAdvancesPermission_ExposesOnlyStaffAdvancesSection()
    {
        var res = await _api.SendAsync(HttpMethod.Get, "/api/reports/dashboard", "advances.viewer");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var json = await res.Content.ReadFromJsonAsync<JsonElement>();

        // Staff advances section populated
        Assert.True(json.TryGetProperty("staffAdvances", out var staffAdv) && staffAdv.ValueKind != JsonValueKind.Null);
        Assert.True(staffAdv.GetProperty("outstandingAmount").GetDecimal() > 0);
        Assert.True(json.TryGetProperty("recentAdvances", out var recAdv) && recAdv.GetArrayLength() > 0);

        // Other financial sections remain redacted
        Assert.True(json.TryGetProperty("sales", out var sales) && sales.ValueKind == JsonValueKind.Null);
        Assert.True(json.TryGetProperty("paymentCollection", out var payments) && payments.ValueKind == JsonValueKind.Null);
        Assert.True(json.TryGetProperty("showroom", out var showroom) && showroom.ValueKind == JsonValueKind.Null);
    }

    [PostgresFact]
    public async Task Http_Dashboard_Owner_ExposesAllSections()
    {
        var res = await _api.SendAsync(HttpMethod.Get, "/api/reports/dashboard", "owner");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var json = await res.Content.ReadFromJsonAsync<JsonElement>();

        // All sections populated for Owner
        Assert.True(json.TryGetProperty("sales", out var sales) && sales.ValueKind != JsonValueKind.Null);
        Assert.True(json.TryGetProperty("paymentCollection", out var payments) && payments.ValueKind != JsonValueKind.Null);
        Assert.True(json.TryGetProperty("showroom", out var showroom) && showroom.ValueKind != JsonValueKind.Null);
        Assert.True(json.TryGetProperty("staffAdvances", out var staffAdv) && staffAdv.ValueKind != JsonValueKind.Null);
        Assert.True(json.TryGetProperty("jobCardKpis", out var jcKpis) && jcKpis.ValueKind != JsonValueKind.Null);
        Assert.True(json.TryGetProperty("vehicleActivity", out var vehAct) && vehAct.ValueKind != JsonValueKind.Null);
        Assert.True(json.TryGetProperty("outstanding", out var outstanding) && outstanding.GetProperty("totalOutstandingCombined").ValueKind != JsonValueKind.Null);
    }
}
