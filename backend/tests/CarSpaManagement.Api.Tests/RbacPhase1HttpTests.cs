using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// RBAC Phase 1 over HTTP: the real pipeline (JWT, [RequirePermission], controllers) on a throwaway PostgreSQL database.
/// Users are seeded with exactly the permissions each case needs.
/// </summary>
public sealed class RbacPhase1Host : IAsyncLifetime
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
        Add("jobcards.only", UserRole.Staff, "jobcards.view", "jobcards.edit");
        Add("outside.viewer", UserRole.Staff, "outsidejobs.view");
        Add("outside.manager", UserRole.Staff, "outsidejobs.view", "outsidejobs.manage");
        Add("outside.manager.drafts", UserRole.Staff, "outsidejobs.view", "outsidejobs.manage", "invoices.edit_draft");
        Add("vendor.viewer", UserRole.Staff, "vendors.view");
        Add("vendor.manager", UserRole.Staff, "vendors.view", "vendors.manage");
        Add("manager", UserRole.Manager, "users.view", "users.edit");
        Add("staff.target", UserRole.Staff, "outsidejobs.manage", "invoices.edit_draft");
        await db.SaveChangesAsync();
    }

    /// <summary>Seeds a job card with one returned outside job at ₹1,000, optionally with a draft invoice billing it.</summary>
    public async Task<(Guid JobCardId, Guid OutsideJobId, Guid VendorId, Guid? InvoiceId)> SeedOutsideJobAsync(bool withDraftInvoice)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var suffix = Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
        var customer = new Customer { Name = "Http Customer", PhoneNumber = "9000000300" };
        var vehicle = new Vehicle { CustomerId = customer.Id, RegistrationNumber = $"TN02HT{suffix}", Make = "Tata", Model = "Nexon" };
        var vendor = new Vendor { Name = $"Http Vendor {suffix}", Phone = "9000000301", IsActive = true };
        var jobCard = new JobCard { JobCardNumber = $"JC-HTTP-{suffix}", CustomerId = customer.Id, VehicleId = vehicle.Id, Status = JobCardStatus.Draft };
        var job = new OutsideJob
        {
            JobCardId = jobCard.Id, VehicleId = vehicle.Id, CustomerId = customer.Id, VendorId = vendor.Id, ServiceName = "Denting",
            Status = OutsideJobStatus.Returned, SentAt = DateTime.UtcNow.AddDays(-2), ExpectedReturnAt = DateTime.UtcNow.AddDays(-1),
            ReturnedAt = DateTime.UtcNow, VendorCost = 1000m,
        };
        db.AddRange(customer, vehicle, vendor, jobCard, job);
        await db.SaveChangesAsync();

        Guid? invoiceId = null;
        if (withDraftInvoice)
            invoiceId = (await scope.ServiceProvider.GetRequiredService<IInvoiceService>().CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id))).Id;
        return (jobCard.Id, job.Id, vendor.Id, invoiceId);
    }

    public async Task<T> QueryAsync<T>(Func<AppDbContext, Task<T>> query)
    {
        using var scope = Services.CreateScope();
        return await query(scope.ServiceProvider.GetRequiredService<AppDbContext>());
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

public class RbacPhase1HttpTests : IClassFixture<RbacPhase1Host>
{
    private readonly RbacPhase1Host _api;
    public RbacPhase1HttpTests(RbacPhase1Host api) => _api = api;

    private static object CreateOutsideJob(Guid vendorId) => new
    {
        vendorId, serviceName = "Painting", expectedReturnAt = DateTime.UtcNow.AddDays(2), vendorCost = 500m,
    };

    // ── P1-3: outside jobs ──────────────────────────────────────────────────

    [PostgresFact]
    public async Task OutsideJobReads_RequireOutsideJobsView_NotJobCardsView()
    {
        var (jobCardId, jobId, _, _) = await _api.SeedOutsideJobAsync(withDraftInvoice: false);
        var reads = new[]
        {
            $"/api/job-cards/{jobCardId}/outside-jobs",
            $"/api/outside-jobs/{jobId}",
            "/api/outside-jobs",
            $"/api/job-cards/{jobCardId}/location",
        };
        foreach (var url in reads)
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await _api.SendAsync(HttpMethod.Get, url, "jobcards.only")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await _api.SendAsync(HttpMethod.Get, url, "outside.viewer")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await _api.SendAsync(HttpMethod.Get, url, "owner")).StatusCode);
        }
    }

    [PostgresFact]
    public async Task OutsideJobMutations_RequireOutsideJobsManage_JobCardsEditIsNotEnough()
    {
        var (jobCardId, jobId, vendorId, _) = await _api.SeedOutsideJobAsync(withDraftInvoice: false);

        var attempts = new (HttpMethod Method, string Url, object? Body)[]
        {
            (HttpMethod.Post, $"/api/job-cards/{jobCardId}/outside-jobs", CreateOutsideJob(vendorId)),
            (HttpMethod.Put, $"/api/outside-jobs/{jobId}/cost", new { vendorCost = 1234m }),
            (HttpMethod.Post, $"/api/outside-jobs/{jobId}/cancel", new { reason = "test" }),
            (HttpMethod.Delete, $"/api/outside-jobs/{jobId}", null),
        };
        foreach (var (method, url, body) in attempts)
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await _api.SendAsync(method, url, "jobcards.only", body)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await _api.SendAsync(method, url, "outside.viewer", body)).StatusCode);
        }
        Assert.Equal(1000m, await _api.QueryAsync(db => db.OutsideJobs.Where(o => o.Id == jobId).Select(o => o.VendorCost!.Value).SingleAsync()));

        var created = await _api.SendAsync(HttpMethod.Post, $"/api/job-cards/{jobCardId}/outside-jobs", "outside.manager", CreateOutsideJob(vendorId));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
    }

    // ── P1-2: vendor cost and the draft invoice ─────────────────────────────

    [PostgresFact]
    public async Task VendorCost_WithoutDraftInvoice_OutsideJobsManageIsEnough()
    {
        var (_, jobId, _, _) = await _api.SeedOutsideJobAsync(withDraftInvoice: false);

        var res = await _api.SendAsync(HttpMethod.Put, $"/api/outside-jobs/{jobId}/cost", "outside.manager", new { vendorCost = 1500m });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(1500m, await _api.QueryAsync(db => db.OutsideJobs.Where(o => o.Id == jobId).Select(o => o.VendorCost!.Value).SingleAsync()));
    }

    [PostgresFact]
    public async Task VendorCost_OnDraftInvoice_WithoutInvoicesEditDraft_Is403_AndInvoiceIsUnchanged()
    {
        var (_, jobId, _, invoiceId) = await _api.SeedOutsideJobAsync(withDraftInvoice: true);
        var totalBefore = await _api.QueryAsync(db => db.Invoices.Where(i => i.Id == invoiceId).Select(i => i.TotalAmount).SingleAsync());

        var res = await _api.SendAsync(HttpMethod.Put, $"/api/outside-jobs/{jobId}/cost", "outside.manager", new { vendorCost = 9999m });

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.Contains("invoices.edit_draft", await res.Content.ReadAsStringAsync());
        Assert.Equal(1000m, await _api.QueryAsync(db => db.OutsideJobs.Where(o => o.Id == jobId).Select(o => o.VendorCost!.Value).SingleAsync()));
        Assert.Equal(totalBefore, await _api.QueryAsync(db => db.Invoices.Where(i => i.Id == invoiceId).Select(i => i.TotalAmount).SingleAsync()));
        Assert.True(await _api.QueryAsync(db => db.AuditLogs.AnyAsync(a => a.Action == "outsidejobs.draft_invoice_change_denied" && a.EntityId == jobId && a.Outcome == "Denied")));
    }

    [PostgresFact]
    public async Task VendorCost_OnDraftInvoice_WithInvoicesEditDraft_UpdatesInvoice_AndIsAudited()
    {
        var (_, jobId, _, invoiceId) = await _api.SeedOutsideJobAsync(withDraftInvoice: true);

        var res = await _api.SendAsync(HttpMethod.Put, $"/api/outside-jobs/{jobId}/cost", "outside.manager.drafts", new { vendorCost = 1800m });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var line = await _api.QueryAsync(db => db.InvoiceItems.Where(it => it.InvoiceId == invoiceId && it.OutsideJobId == jobId).Select(it => it.UnitPrice).SingleAsync());
        Assert.Equal(1800m, line);
        Assert.Equal(1800m, await _api.QueryAsync(db => db.Invoices.Where(i => i.Id == invoiceId).Select(i => i.TotalAmount).SingleAsync()));
        Assert.True(await _api.QueryAsync(db => db.AuditLogs.AnyAsync(a => a.Action == "outsidejobs.edit" && a.EntityId == jobId && a.Outcome == "Success")));
    }

    [PostgresFact]
    public async Task VendorCost_OnDraftInvoice_Owner_IsAuthorized()
    {
        var (_, jobId, _, invoiceId) = await _api.SeedOutsideJobAsync(withDraftInvoice: true);

        var res = await _api.SendAsync(HttpMethod.Put, $"/api/outside-jobs/{jobId}/cost", "owner", new { vendorCost = 1200m });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(1200m, await _api.QueryAsync(db => db.Invoices.Where(i => i.Id == invoiceId).Select(i => i.TotalAmount).SingleAsync()));
    }

    [PostgresFact]
    public async Task DeleteOutsideJob_OnDraftInvoice_RequiresInvoicesEditDraft()
    {
        var (_, jobId, _, invoiceId) = await _api.SeedOutsideJobAsync(withDraftInvoice: true);

        Assert.Equal(HttpStatusCode.Forbidden, (await _api.SendAsync(HttpMethod.Delete, $"/api/outside-jobs/{jobId}", "outside.manager")).StatusCode);
        Assert.False(await _api.QueryAsync(db => db.OutsideJobs.IgnoreQueryFilters().Where(o => o.Id == jobId).Select(o => o.IsDeleted).SingleAsync()));

        Assert.Equal(HttpStatusCode.NoContent, (await _api.SendAsync(HttpMethod.Delete, $"/api/outside-jobs/{jobId}", "outside.manager.drafts")).StatusCode);
        Assert.Equal(0m, await _api.QueryAsync(db => db.Invoices.Where(i => i.Id == invoiceId).Select(i => i.TotalAmount).SingleAsync()));
    }

    // ── P1-3: vendors ───────────────────────────────────────────────────────

    [PostgresFact]
    public async Task VendorReads_RequireVendorsView_AndWritesRequireVendorsManage()
    {
        var (_, _, vendorId, _) = await _api.SeedOutsideJobAsync(withDraftInvoice: false);
        var newVendor = new { name = $"Vendor {Guid.NewGuid():N}"[..20], phone = "9000000400" };
        var update = new { name = "Renamed Vendor", phone = "9000000401", isActive = true };

        foreach (var url in new[] { "/api/vendors", $"/api/vendors/{vendorId}" })
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await _api.SendAsync(HttpMethod.Get, url, "jobcards.only")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await _api.SendAsync(HttpMethod.Get, url, "vendor.viewer")).StatusCode);
        }

        foreach (var user in new[] { "jobcards.only", "vendor.viewer" })
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await _api.SendAsync(HttpMethod.Post, "/api/vendors", user, newVendor)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await _api.SendAsync(HttpMethod.Put, $"/api/vendors/{vendorId}", user, update)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await _api.SendAsync(HttpMethod.Delete, $"/api/vendors/{vendorId}", user)).StatusCode);
        }

        var created = await _api.SendAsync(HttpMethod.Post, "/api/vendors", "vendor.manager", newVendor);
        Assert.True(created.IsSuccessStatusCode, $"vendors.manage should create a vendor, got {(int)created.StatusCode}");
        Assert.True((await _api.SendAsync(HttpMethod.Put, $"/api/vendors/{vendorId}", "vendor.manager", update)).IsSuccessStatusCode);
    }

    // ── P1-1 over HTTP ──────────────────────────────────────────────────────

    [PostgresFact]
    public async Task Manager_CannotResetStaffPassword_OverHttp_ButOwnerCan()
    {
        var targetId = _api.Users["staff.target"].Id;
        var hashBefore = await _api.QueryAsync(db => db.Users.Where(u => u.Id == targetId).Select(u => u.PasswordHash).SingleAsync());
        var reset = new { fullName = "staff.target", password = "Changed-Pass456!", confirmPassword = "Changed-Pass456!" };

        var denied = await _api.SendAsync(HttpMethod.Put, $"/api/users/{targetId}", "manager", reset);
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        Assert.Equal(hashBefore, await _api.QueryAsync(db => db.Users.Where(u => u.Id == targetId).Select(u => u.PasswordHash).SingleAsync()));

        // The manager can still edit the Staff profile without a password.
        var profile = await _api.SendAsync(HttpMethod.Put, $"/api/users/{targetId}", "manager", new { fullName = "Staff Target" });
        Assert.Equal(HttpStatusCode.OK, profile.StatusCode);

        var allowed = await _api.SendAsync(HttpMethod.Put, $"/api/users/{targetId}", "owner", reset);
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        Assert.NotEqual(hashBefore, await _api.QueryAsync(db => db.Users.Where(u => u.Id == targetId).Select(u => u.PasswordHash).SingleAsync()));
    }
}

/// <summary>RBAC P1-3 grant migration on real PostgreSQL: re-run over seeded users and check exactly who gained what.</summary>
public class RbacPhase1GrantMigrationTests : IClassFixture<PostgresTestDatabase>
{
    private const string PreviousMigration = "20261004170844_AddShowroomTypeNameUniqueAndIsOther";
    private readonly PostgresTestDatabase _pg;
    public RbacPhase1GrantMigrationTests(PostgresTestDatabase pg) => _pg = pg;

    [PostgresFact]
    public async Task GrantMigration_CopiesJobCardAccess_IsIdempotent_AndGrantsNothingElse()
    {
        Guid viewer, editor, unrelated, revoked, alreadyHas;
        await using (var db = _pg.CreateContext())
        {
            await PermissionSeeder.SeedAsync(db);
            var p = await db.Permissions.ToDictionaryAsync(x => x.Code, x => x.Id);
            User Make(string name, params string[] codes)
            {
                var u = new User { FullName = name, Username = $"{name}.{Guid.NewGuid():N}"[..30], Role = UserRole.Staff, IsActive = true, PasswordHash = "x" };
                foreach (var c in codes) u.UserPermissions.Add(new UserPermission { UserId = u.Id, PermissionId = p[c] });
                db.Users.Add(u);
                return u;
            }
            viewer = Make("viewer", "jobcards.view").Id;
            editor = Make("editor", "jobcards.view", "jobcards.edit").Id;
            unrelated = Make("unrelated", "customers.view").Id;
            alreadyHas = Make("already", "jobcards.view", "outsidejobs.view").Id;
            var rev = Make("revoked", "jobcards.view");
            rev.UserPermissions.Add(new UserPermission { UserId = rev.Id, PermissionId = p["vendors.view"], IsDeleted = true });
            revoked = rev.Id;
            await db.SaveChangesAsync();
        }

        // Re-run the migration over these rows twice (down one step is a no-op, up re-applies) to prove it is idempotent.
        for (var run = 0; run < 2; run++)
        {
            await using var db = _pg.CreateContext();
            var migrator = db.GetService<IMigrator>();
            await migrator.MigrateAsync(PreviousMigration);
            await migrator.MigrateAsync();
        }

        await using var read = _pg.CreateContext();
        async Task<string[]> CodesOf(Guid id) => (await read.UserPermissions.AsNoTracking().Where(up => up.UserId == id)
            .Select(up => up.Permission.Code).ToListAsync()).OrderBy(c => c).ToArray();

        Assert.Equal(["jobcards.view", "outsidejobs.view", "vendors.view"], await CodesOf(viewer));
        Assert.Equal(["jobcards.edit", "jobcards.view", "outsidejobs.manage", "outsidejobs.view", "vendors.manage", "vendors.view"], await CodesOf(editor));
        Assert.Equal(["customers.view"], await CodesOf(unrelated));
        Assert.Equal(["jobcards.view", "outsidejobs.view", "vendors.view"], await CodesOf(alreadyHas));
        // A revoked (soft-deleted) vendors.view is not brought back.
        Assert.Equal(["jobcards.view", "outsidejobs.view"], await CodesOf(revoked));

        // No duplicate active grants anywhere.
        var duplicates = await read.UserPermissions.AsNoTracking().Where(up => !up.IsDeleted)
            .GroupBy(up => new { up.UserId, up.PermissionId }).CountAsync(g => g.Count() > 1);
        Assert.Equal(0, duplicates);
        Assert.Equal(1, await read.Permissions.CountAsync(x => x.Code == "outsidejobs.manage"));
    }
}
