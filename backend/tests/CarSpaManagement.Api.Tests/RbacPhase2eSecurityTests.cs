using CarSpaManagement.Api.Infrastructure.Tenancy;
using CarSpaManagement.Api.Application.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.DTOs.StaffAdvances;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// RBAC Phase 2E security test host running against live PostgreSQL.
/// Verifies Finding 2E-01 (price override enforcement) and Finding 2E-02 (staff financial advance redaction).
/// </summary>
public sealed class RbacPhase2eHost : IAsyncLifetime
{
    private readonly PostgresTestDatabase _database = new();
    private WebApplicationFactory<AppDbContext>? _factory;

    public HttpClient Client { get; private set; } = null!;
    public IServiceProvider Services => _factory!.Services;
    public Dictionary<string, User> Users { get; } = new();
    public const string Password = "Valid-Pass123!";

    public Guid CustomerId { get; private set; }
    public Guid VehicleId { get; private set; }
    public Guid Service1Id { get; private set; }
    public Guid Service2Id { get; private set; }
    public decimal Service1Price => 500m;
    public decimal Service2Price => 1200m;
    public Guid StaffId { get; private set; }

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
        Add("jobcard.creator", UserRole.Staff, "jobcards.create", "jobcards.view", "customers.view", "catalogue.view");
        Add("jobcard.editor", UserRole.Staff, "jobcards.edit", "jobcards.view", "customers.view", "catalogue.view");
        Add("jobcard.price.overrider", UserRole.Staff, "jobcards.create", "jobcards.edit", "jobcards.view", "customers.view", "catalogue.view", "invoices.price_override");
        Add("staff.viewer", UserRole.Staff, "staff.view");
        Add("staff.advances.viewer", UserRole.Staff, "staff.view", "staff_advances.view");
        Add("no.permissions", UserRole.Staff);

        // Seed domain data
        var customer = new Customer { Name = "E2E Customer", PhoneNumber = "9988776655" };
        db.Customers.Add(customer);
        CustomerId = customer.Id;

        var vehicle = new Vehicle { CustomerId = customer.Id, RegistrationNumber = "TN09AB9999", Make = "Honda", Model = "City" };
        db.Vehicles.Add(vehicle);
        VehicleId = vehicle.Id;

        var svc1 = new Service { Name = "Basic Wash", Price = Service1Price, TaxPercentage = 18m, IsActive = true };
        var svc2 = new Service { Name = "Interior Detailing", Price = Service2Price, TaxPercentage = 18m, IsActive = true };
        db.Services.AddRange(svc1, svc2);
        Service1Id = svc1.Id;
        Service2Id = svc2.Id;

        var staff = new Staff { StaffMasterId = "RD001R", Name = "Ramesh Detailer", PhoneNumber = "9876543210", IsActive = true };
        db.Staff.Add(staff);
        StaffId = staff.Id;

        var advance = new StaffAdvance
        {
            StaffId = staff.Id,
            Amount = 2000m,
            AdvanceDate = DateTime.UtcNow.Date,
            Reason = "Festival Advance",
            Status = StaffAdvanceStatus.Outstanding,
        };
        db.StaffAdvances.Add(advance);

        await db.SaveChangesAsync();
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

public class RbacPhase2eSecurityTests : IClassFixture<RbacPhase2eHost>
{
    private readonly RbacPhase2eHost _api;
    public RbacPhase2eSecurityTests(RbacPhase2eHost api) => _api = api;

    // ══════════════════════════════════════════════════════════════════════════
    // FINDING 2E-01: ENFORCE invoices.price_override
    // ══════════════════════════════════════════════════════════════════════════

    [PostgresFact]
    public async Task JobCardCreate_UnauthorizedCustomPrice_ReturnsForbidden403()
    {
        var req = new CreateJobCardRequest
        {
            CustomerId = _api.CustomerId,
            VehicleId = _api.VehicleId,
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = _api.Service1Id, Quantity = 1, UnitPrice = 750m } // Catalogue price is 500
            }
        };

        var res = await _api.SendAsync(HttpMethod.Post, "/api/job-cards", "jobcard.creator", req);
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [PostgresFact]
    public async Task JobCardCreate_CataloguePrice_SucceedsForStaffWithoutPriceOverride()
    {
        var req = new CreateJobCardRequest
        {
            CustomerId = _api.CustomerId,
            VehicleId = _api.VehicleId,
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = _api.Service1Id, Quantity = 1, UnitPrice = _api.Service1Price } // Exactly catalogue price
            }
        };

        var res = await _api.SendAsync(HttpMethod.Post, "/api/job-cards", "jobcard.creator", req);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
    }

    [PostgresFact]
    public async Task JobCardCreate_NullUnitPrice_UsesCataloguePriceAndSucceeds()
    {
        var req = new CreateJobCardRequest
        {
            CustomerId = _api.CustomerId,
            VehicleId = _api.VehicleId,
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = _api.Service1Id, Quantity = 1, UnitPrice = null } // Default/catalogue price
            }
        };

        var res = await _api.SendAsync(HttpMethod.Post, "/api/job-cards", "jobcard.creator", req);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
    }

    [PostgresFact]
    public async Task JobCardCreate_AuthorizedCustomPrice_SucceedsForUserWithPriceOverride()
    {
        var req = new CreateJobCardRequest
        {
            CustomerId = _api.CustomerId,
            VehicleId = _api.VehicleId,
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = _api.Service1Id, Quantity = 1, UnitPrice = 850m } // Custom price with permission
            }
        };

        var res = await _api.SendAsync(HttpMethod.Post, "/api/job-cards", "jobcard.price.overrider", req);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
    }

    [PostgresFact]
    public async Task JobCardCreate_AuthorizedCustomPrice_SucceedsForOwnerBypass()
    {
        var req = new CreateJobCardRequest
        {
            CustomerId = _api.CustomerId,
            VehicleId = _api.VehicleId,
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = _api.Service1Id, Quantity = 1, UnitPrice = 900m } // Custom price for Owner
            }
        };

        var res = await _api.SendAsync(HttpMethod.Post, "/api/job-cards", "owner", req);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
    }

    [PostgresFact]
    public async Task JobCardCreate_MultipleServices_OneUnauthorizedOverride_RejectsEntireOperation()
    {
        using var scope = _api.Services.CreateTestScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var countBefore = await db.JobCards.CountAsync();

        var req = new CreateJobCardRequest
        {
            CustomerId = _api.CustomerId,
            VehicleId = _api.VehicleId,
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = _api.Service1Id, Quantity = 1, UnitPrice = _api.Service1Price }, // Valid catalogue price
                new() { ServiceId = _api.Service2Id, Quantity = 1, UnitPrice = 1500m } // Unauthorized override (catalogue is 1200)
            }
        };

        var res = await _api.SendAsync(HttpMethod.Post, "/api/job-cards", "jobcard.creator", req);
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);

        // Verify atomicity: no partial entity was created
        var countAfter = await db.JobCards.CountAsync();
        Assert.Equal(countBefore, countAfter);
    }

    [PostgresFact]
    public async Task JobCardUpdateServices_UnauthorizedCustomPrice_ReturnsForbidden403()
    {
        // First create a job card with valid catalogue price
        var createReq = new CreateJobCardRequest
        {
            CustomerId = _api.CustomerId,
            VehicleId = _api.VehicleId,
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = _api.Service1Id, Quantity = 1, UnitPrice = _api.Service1Price }
            }
        };

        var createRes = await _api.SendAsync(HttpMethod.Post, "/api/job-cards", "jobcard.creator", createReq);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);

        var created = await createRes.Content.ReadFromJsonAsync<JsonElement>();
        var jcId = created.GetProperty("id").GetGuid();

        // Now attempt update with unauthorized custom price
        var updateReq = new UpdateJobCardServicesRequest
        {
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = _api.Service1Id, Quantity = 1, UnitPrice = 650m }
            }
        };

        var updateRes = await _api.SendAsync(HttpMethod.Put, $"/api/job-cards/{jcId}/services", "jobcard.editor", updateReq);
        Assert.Equal(HttpStatusCode.Forbidden, updateRes.StatusCode);
    }

    [PostgresFact]
    public async Task JobCardPreview_UnauthorizedCustomPrice_ReturnsForbidden403()
    {
        var previewReq = new PreviewJobCardRequest
        {
            Services = new List<JobCardServiceItemRequest>
            {
                new() { ServiceId = _api.Service1Id, Quantity = 1, UnitPrice = 750m }
            }
        };

        var res = await _api.SendAsync(HttpMethod.Post, "/api/job-cards/preview", "jobcard.creator", previewReq);
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FINDING 2E-02: PROTECT STAFF ADVANCE FINANCIAL DATA IN StaffDto
    // ══════════════════════════════════════════════════════════════════════════

    [PostgresFact]
    public async Task StaffDirectory_WithoutAdvancesView_RedactsFinancialAdvanceFieldsToNull()
    {
        var res = await _api.SendAsync(HttpMethod.Get, "/api/staff-advances/staff", "staff.viewer");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var staffList = await res.Content.ReadFromJsonAsync<List<StaffDto>>();
        Assert.NotNull(staffList);
        Assert.NotEmpty(staffList);

        var targetStaff = staffList.FirstOrDefault(s => s.Id == _api.StaffId);
        Assert.NotNull(targetStaff);
        Assert.Null(targetStaff.TotalAdvances);
        Assert.Null(targetStaff.TotalAdvanceAmount);
    }

    [PostgresFact]
    public async Task StaffDetail_WithoutAdvancesView_RedactsFinancialAdvanceFieldsToNull()
    {
        var res = await _api.SendAsync(HttpMethod.Get, $"/api/staff-advances/staff/{_api.StaffId}", "staff.viewer");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var staffDto = await res.Content.ReadFromJsonAsync<StaffDto>();
        Assert.NotNull(staffDto);
        Assert.Null(staffDto.TotalAdvances);
        Assert.Null(staffDto.TotalAdvanceAmount);
    }

    [PostgresFact]
    public async Task StaffDirectory_WithAdvancesView_ReturnsFinancialAdvanceFigures()
    {
        var res = await _api.SendAsync(HttpMethod.Get, "/api/staff-advances/staff", "staff.advances.viewer");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var staffList = await res.Content.ReadFromJsonAsync<List<StaffDto>>();
        Assert.NotNull(staffList);
        Assert.NotEmpty(staffList);

        var targetStaff = staffList.FirstOrDefault(s => s.Id == _api.StaffId);
        Assert.NotNull(targetStaff);
        Assert.Equal(1, targetStaff.TotalAdvances);
        Assert.Equal(2000m, targetStaff.TotalAdvanceAmount);
    }

    [PostgresFact]
    public async Task StaffDirectory_Owner_ReturnsFinancialAdvanceFigures()
    {
        var res = await _api.SendAsync(HttpMethod.Get, "/api/staff-advances/staff", "owner");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var staffList = await res.Content.ReadFromJsonAsync<List<StaffDto>>();
        Assert.NotNull(staffList);
        Assert.NotEmpty(staffList);

        var targetStaff = staffList.FirstOrDefault(s => s.Id == _api.StaffId);
        Assert.NotNull(targetStaff);
        Assert.Equal(1, targetStaff.TotalAdvances);
        Assert.Equal(2000m, targetStaff.TotalAdvanceAmount);
    }
}
