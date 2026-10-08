using System.IdentityModel.Tokens.Jwt;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// The multi-company safety net. Two companies share one database; none of the tests below may ever let one
/// see, change or move the other's data.
/// </summary>
public class TenantIsolationTests
{
    private static readonly Guid OrgA = Guid.Parse("aaaaaaaa-0000-0000-0000-00000000000a");
    private static readonly Guid OrgB = Guid.Parse("bbbbbbbb-0000-0000-0000-00000000000b");

    private sealed class SharedDatabase
    {
        private readonly string _name = Guid.NewGuid().ToString();

        public AppDbContext For(ITenantContext tenant)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(_name)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options, tenant);
        }

        public AppDbContext As(Guid organizationId) => For(new FixedTenantContext(organizationId));
    }

    private static Customer NewCustomer(string name, string phone = "9000000001") => new() { Name = name, PhoneNumber = phone };

    // ── The model itself ────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public void EveryBusinessTable_IsOwnedByAnOrganization_SoNewTablesCannotBeForgotten()
    {
        var platformTables = new HashSet<Type> { typeof(Organization), typeof(Permission) };
        var entityTypes = typeof(AppDbContext).Assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false, Namespace: "CarSpaManagement.Api.Domain.Entities" })
            .Where(t => !t.IsNested && !t.Name.StartsWith('<'))
            .ToList();

        // Only tables that are actually part of the database (a DbSet) count.
        var mapped = new SharedDatabase().As(OrgA).Model.GetEntityTypes().Select(e => e.ClrType).ToHashSet();
        var forgotten = entityTypes
            .Where(mapped.Contains)
            .Where(t => !platformTables.Contains(t))
            .Where(t => !typeof(IOrganizationOwned).IsAssignableFrom(t))
            .Select(t => t.Name)
            .ToList();

        Assert.True(forgotten.Count == 0, "These tables have no organization: " + string.Join(", ", forgotten));
    }

    [Fact]
    public void EveryOrganizationOwnedTable_IsFilteredToTheCurrentCompany_AndByDeletion()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=localhost;Database=never_connected").Options;
        using var db = new AppDbContext(options, new FixedTenantContext(OrgA));

        var missing = new List<string>();
        foreach (var entityType in db.Model.GetEntityTypes().Where(e => typeof(IOrganizationOwned).IsAssignableFrom(e.ClrType)))
        {
            var query = (IQueryable)typeof(DbContext).GetMethod(nameof(DbContext.Set), Type.EmptyTypes)!
                .MakeGenericMethod(entityType.ClrType).Invoke(db, null)!;
            var sql = query.ToQueryString();

            if (!sql.Contains("OrganizationId", StringComparison.Ordinal)) missing.Add(entityType.ClrType.Name + " (company)");
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType) && !sql.Contains("IsDeleted", StringComparison.Ordinal))
                missing.Add(entityType.ClrType.Name + " (deleted)");
        }

        Assert.True(missing.Count == 0, "Missing filter on: " + string.Join(", ", missing));
    }

    [Fact]
    public void BypassingOnlyTheDeletedFilter_StillKeepsTheCompanyFilter()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=localhost;Database=never_connected").Options;
        using var db = new AppDbContext(options, new FixedTenantContext(OrgA));

        var sql = db.Customers.IgnoreQueryFilters([AppDbContext.SoftDeleteFilter]).ToQueryString();

        Assert.Contains("OrganizationId", sql);
        Assert.DoesNotContain("IsDeleted\" =", sql.Replace(" ", ""));
    }

    // ── Reading ─────────────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task OneCompany_CannotSeeAnotherCompanysRows()
    {
        var shared = new SharedDatabase();
        await using (var a = shared.As(OrgA))
        {
            a.Customers.Add(NewCustomer("Alice's customer"));
            await a.SaveChangesAsync();
        }
        await using (var b = shared.As(OrgB))
        {
            b.Customers.Add(NewCustomer("Bob's customer", "9000000002"));
            await b.SaveChangesAsync();
        }

        await using var asA = shared.As(OrgA);
        await using var asB = shared.As(OrgB);

        Assert.Equal(["Alice's customer"], await asA.Customers.Select(c => c.Name).ToListAsync());
        Assert.Equal(["Bob's customer"], await asB.Customers.Select(c => c.Name).ToListAsync());

        var aliceId = (await asA.Customers.SingleAsync()).Id;
        Assert.Null(await asB.Customers.FindAsync(aliceId));
        Assert.False(await asB.Customers.AnyAsync(c => c.Id == aliceId));
    }

    [Fact]
    public async Task WithNoCompany_NothingIsVisible()
    {
        var shared = new SharedDatabase();
        await using (var a = shared.As(OrgA))
        {
            a.Customers.Add(NewCustomer("Alice's customer"));
            await a.SaveChangesAsync();
        }

        await using var nobody = shared.For(NoTenantContext.Instance);
        Assert.Empty(await nobody.Customers.ToListAsync());
    }

    [Fact]
    public async Task IncludedChildren_AreFilteredToo()
    {
        var shared = new SharedDatabase();
        var customerA = NewCustomer("A");
        await using (var a = shared.As(OrgA))
        {
            a.Customers.Add(customerA);
            a.Vehicles.Add(new Vehicle { CustomerId = customerA.Id, RegistrationNumber = "TN01AB1111", Make = "Hyundai", Model = "Creta" });
            await a.SaveChangesAsync();
        }

        await using var b = shared.As(OrgB);
        Assert.Empty(await b.Vehicles.ToListAsync());
        Assert.Empty(await b.Customers.Include(c => c.Vehicles).ToListAsync());
    }

    // ── Writing ─────────────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task NewRows_AreStampedWithTheCurrentCompany()
    {
        var shared = new SharedDatabase();
        await using var a = shared.As(OrgA);
        var customer = NewCustomer("Stamped");
        a.Customers.Add(customer);
        await a.SaveChangesAsync();

        Assert.Equal(OrgA, customer.OrganizationId);
    }

    [Fact]
    public void SynchronousSaves_AreStampedAndChecked_Too()
    {
        var shared = new SharedDatabase();
        using var a = shared.As(OrgA);
        var customer = NewCustomer("Sync");
        a.Customers.Add(customer);
        a.SaveChanges();
        Assert.Equal(OrgA, customer.OrganizationId);

        var foreign = NewCustomer("Foreign", "9000000009");
        foreign.OrganizationId = OrgB;
        a.Customers.Add(foreign);
        Assert.Throws<TenantViolationException>(() => a.SaveChanges());
    }

    [Fact]
    public async Task ARowCannotBeCreatedForAnotherCompany()
    {
        var shared = new SharedDatabase();
        await using var a = shared.As(OrgA);
        var customer = NewCustomer("Sneaky");
        customer.OrganizationId = OrgB;
        a.Customers.Add(customer);

        await Assert.ThrowsAsync<TenantViolationException>(() => a.SaveChangesAsync());
    }

    [Fact]
    public async Task ARowCannotBeMovedToAnotherCompany()
    {
        var shared = new SharedDatabase();
        await using var a = shared.As(OrgA);
        var customer = NewCustomer("Mine");
        a.Customers.Add(customer);
        await a.SaveChangesAsync();

        customer.OrganizationId = OrgB;

        await Assert.ThrowsAsync<TenantViolationException>(() => a.SaveChangesAsync());
    }

    [Fact]
    public async Task AnotherCompanysRow_CannotBeChangedOrDeleted_EvenIfCodeGetsHoldOfIt()
    {
        var shared = new SharedDatabase();
        Guid aliceId;
        await using (var a = shared.As(OrgA))
        {
            var customer = NewCustomer("Alice's customer");
            a.Customers.Add(customer);
            await a.SaveChangesAsync();
            aliceId = customer.Id;
        }

        await using (var b = shared.As(OrgB))
        {
            // Pretend a bug loaded the other company's row (here by attaching it directly).
            var stolen = new Customer { Id = aliceId, OrganizationId = OrgA, Name = "Hacked", PhoneNumber = "9000000001" };
            b.Customers.Attach(stolen);
            b.Entry(stolen).Property(c => c.Name).IsModified = true;
            await Assert.ThrowsAsync<TenantViolationException>(() => b.SaveChangesAsync());
        }

        await using (var b = shared.As(OrgB))
        {
            var stolen = new Customer { Id = aliceId, OrganizationId = OrgA, Name = "Alice's customer", PhoneNumber = "9000000001" };
            b.Customers.Attach(stolen);
            b.Customers.Remove(stolen);
            await Assert.ThrowsAsync<TenantViolationException>(() => b.SaveChangesAsync());
        }

        await using var again = shared.As(OrgA);
        Assert.Equal("Alice's customer", (await again.Customers.SingleAsync()).Name);
    }

    [Fact]
    public async Task WithNoCompany_NothingCanBeSaved_UnlessACompanyIsGivenExplicitly()
    {
        var shared = new SharedDatabase();
        await using var nobody = shared.For(NoTenantContext.Instance);

        nobody.Customers.Add(NewCustomer("Orphan"));
        await Assert.ThrowsAsync<TenantViolationException>(() => nobody.SaveChangesAsync());
    }

    [Fact]
    public async Task SameBusinessData_CanExistInTwoCompanies()
    {
        var shared = new SharedDatabase();
        foreach (var org in new[] { OrgA, OrgB })
        {
            await using var db = shared.As(org);
            var customer = NewCustomer("Same name", "9000000001");
            db.Customers.Add(customer);
            await db.SaveChangesAsync();
        }

        await using var asA = shared.As(OrgA);
        Assert.Single(await asA.Customers.ToListAsync());
    }

    // ── The tenant context itself ───────────────────────────────────────────────────────────────────────────

    [Fact]
    public void TheCompanyOfARequest_CanBeSetOnce_AndNeverSwitched()
    {
        var tenant = new TenantContext();
        Assert.Null(tenant.OrganizationId);

        tenant.Set(OrgA);
        tenant.Set(OrgA); // setting the same company again is harmless

        Assert.Equal(OrgA, tenant.OrganizationId);
        Assert.Throws<TenantViolationException>(() => tenant.Set(OrgB));
        Assert.Throws<ArgumentException>(() => new TenantContext().Set(Guid.Empty));
    }

    [Fact]
    public async Task TheMiddleware_TakesTheCompanyFromTheSignedToken_AndIgnoresAnythingElse()
    {
        var tenant = new TenantContext();
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(JwtTokenService.OrganizationClaim, OrgA.ToString())], "test"))
        };
        await new TenantResolutionMiddleware(_ => Task.CompletedTask).InvokeAsync(context, tenant);
        Assert.Equal(OrgA, tenant.OrganizationId);

        // A header or query string cannot choose the company.
        var spoofed = new TenantContext();
        var anonymous = new DefaultHttpContext();
        anonymous.Request.Headers["X-Organization-Id"] = OrgB.ToString();
        anonymous.Request.QueryString = new QueryString($"?org={OrgB}");
        await new TenantResolutionMiddleware(_ => Task.CompletedTask).InvokeAsync(anonymous, spoofed);
        Assert.Null(spoofed.OrganizationId);

        // A token with no (or a broken) company leaves the request without one.
        foreach (var bad in new[] { "", "not-a-guid", Guid.Empty.ToString() })
        {
            var t = new TenantContext();
            var ctx = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(JwtTokenService.OrganizationClaim, bad)], "test"))
            };
            await new TenantResolutionMiddleware(_ => Task.CompletedTask).InvokeAsync(ctx, t);
            Assert.Null(t.OrganizationId);
        }
    }

    // ── Sign-in by company code ─────────────────────────────────────────────────────────────────────────────

    private sealed class NoAudit : IAuditLogService
    {
        public Task RecordAsync(string action, string module, string description, Guid? userId = null, string? userName = null,
            string? userRole = null, string? entityType = null, Guid? entityId = null, string? entityReference = null,
            string? oldValues = null, string? newValues = null, string? metadata = null, string outcome = "Success",
            CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<PagedResult<AuditLogDto>> GetLogsAsync(AuditLogQueryParameters query, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();
    }

    private sealed class SignInHarness
    {
        public AppDbContext Db { get; }
        public TenantContext Tenant { get; } = new();
        public AuthService Auth { get; }
        public AccountLockoutService Lockout { get; } = new();

        public SignInHarness(int companies = 2)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            Db = new AppDbContext(options, Tenant);
            var hasher = new PasswordHasherService();
            var jwt = new JwtTokenService(Options.Create(new JwtOptions
            {
                Key = "test_signing_key_32_bytes_length_minimum_for_sha256!",
                Issuer = "CarSpaManagement",
                Audience = "CarSpaManagementClients",
                ExpirationMinutes = 60
            }));
            Auth = new AuthService(Db, hasher, jwt, new NoAudit(), Lockout, Tenant);

            var companyDefinitions = new[] { (OrgA, "01-0001", "Alice"), (OrgB, "01-0002", "Bob") }.Take(companies);
            foreach (var (id, code, owner) in companyDefinitions)
            {
                Db.Organizations.Add(new Organization { Id = id, Code = code, BusinessType = BusinessType.CarSpa, IsActive = true });
                // A user with the same username and password in every company.
                var user = new User { Id = Guid.NewGuid(), OrganizationId = id, FullName = $"{owner} Owner", Username = "admin", Role = UserRole.Owner, IsActive = true };
                user.PasswordHash = hasher.HashPassword(user, "CorrectPassword123!");
                Db.Users.Add(user);
            }
            Db.SaveChanges();
        }
    }

    private static string OrganizationOf(string token) =>
        new JwtSecurityTokenHandler().ReadJwtToken(token).Claims.Single(c => c.Type == JwtTokenService.OrganizationClaim).Value;

    [Fact]
    public async Task SignIn_UsesTheCompanyCode_AndTheTokenCarriesThatCompany()
    {
        var h = new SignInHarness();

        var asA = await h.Auth.LoginAsync(new LoginRequest { Username = "admin", Password = "CorrectPassword123!", CompanyCode = "01-0001" });

        Assert.Equal("01-0001", asA.CompanyCode);
        Assert.Equal("Alice Owner", asA.User.FullName);
        Assert.Equal(OrgA.ToString(), OrganizationOf(asA.Token));
        Assert.Equal(OrgA, h.Tenant.OrganizationId);
    }

    [Fact]
    public async Task TwoCompanies_CanBothHaveAnAdminUser_AndEachSignsInToItsOwn()
    {
        var a = new SignInHarness();
        var b = new SignInHarness();

        var asB = await b.Auth.LoginAsync(new LoginRequest { Username = "ADMIN", Password = "CorrectPassword123!", CompanyCode = " 01-0002 " });
        var asA = await a.Auth.LoginAsync(new LoginRequest { Username = "admin", Password = "CorrectPassword123!", CompanyCode = "01-0001" });

        Assert.Equal("Bob Owner", asB.User.FullName);
        Assert.Equal("Alice Owner", asA.User.FullName);
    }

    [Theory]
    [InlineData("99-9999")]
    [InlineData("nonsense")]
    public async Task SignIn_WithAnUnknownCompanyCode_LooksLikeAnyOtherFailure(string code)
    {
        var h = new SignInHarness();

        var ex = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            h.Auth.LoginAsync(new LoginRequest { Username = "admin", Password = "CorrectPassword123!", CompanyCode = code }));

        Assert.Equal("Invalid company code, username or password.", ex.Message);
        Assert.Null(h.Tenant.OrganizationId);
    }

    [Fact]
    public async Task SignIn_WithoutACode_IsRefused_WhenSeveralCompaniesExist()
    {
        var h = new SignInHarness(companies: 2);

        var ex = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            h.Auth.LoginAsync(new LoginRequest { Username = "admin", Password = "CorrectPassword123!" }));

        Assert.Equal("Company code is required.", ex.Message);
    }

    [Fact]
    public async Task SignIn_WithoutACode_StillWorks_WhileThereIsOnlyOneCompany()
    {
        var h = new SignInHarness(companies: 1);

        var response = await h.Auth.LoginAsync(new LoginRequest { Username = "admin", Password = "CorrectPassword123!" });

        Assert.Equal("01-0001", response.CompanyCode);
        Assert.Equal(OrgA.ToString(), OrganizationOf(response.Token));
    }

    [Fact]
    public async Task AnInactiveCompany_CannotSignIn()
    {
        var h = new SignInHarness();
        (await h.Db.Organizations.SingleAsync(o => o.Id == OrgA)).IsActive = false;
        await h.Db.SaveChangesAsync();

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            h.Auth.LoginAsync(new LoginRequest { Username = "admin", Password = "CorrectPassword123!", CompanyCode = "01-0001" }));
    }

    [Fact]
    public async Task ALockout_AffectsOnlyTheCompanyItHappenedIn()
    {
        var a = new SignInHarness();

        for (var i = 1; i <= 5; i++)
        {
            try
            {
                await new SignInHarnessLogin(a).Attempt("01-0001", $"Wrong{i}!");
            }
            catch (Exception)
            {
                // the last attempt locks the account
            }
        }

        Assert.True(a.Lockout.CheckLockout(AccountLockoutKey.For("01-0001", "admin")).IsLocked);
        Assert.False(a.Lockout.CheckLockout(AccountLockoutKey.For("01-0002", "admin")).IsLocked);
    }

    private sealed class SignInHarnessLogin(SignInHarness harness)
    {
        public Task Attempt(string code, string password)
        {
            // each request gets a fresh tenant scope in the real app; here the harness's context is single use
            harness.Tenant.GetType().GetField("<OrganizationId>k__BackingField",
                System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!.SetValue(harness.Tenant, null);
            return harness.Auth.LoginAsync(new LoginRequest { Username = "admin", Password = password, CompanyCode = code });
        }
    }

    // ── First-time setup ────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task FirstTimeSetup_CreatesTheFirstCompanyAndItsOwner_AndOnlyOnce()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        var tenant = new TenantContext();
        var db = new AppDbContext(options, tenant);
        var auth = new AuthService(db, new PasswordHasherService(), new JwtTokenService(Options.Create(new JwtOptions
        {
            Key = "test_signing_key_32_bytes_length_minimum_for_sha256!", ExpirationMinutes = 60
        })), new NoAudit(), new AccountLockoutService(), tenant);

        Assert.False((await auth.GetStatusAsync()).Initialized);

        var owner = await auth.BootstrapOwnerAsync(new BootstrapOwnerRequest
        {
            FullName = "Sunrise Owner", Username = "Owner1", Password = "Strong#Pass2026x", ConfirmPassword = "Strong#Pass2026x"
        });

        var company = await db.Organizations.SingleAsync();
        Assert.Equal("01-0001", company.Code);
        Assert.Equal(BusinessType.CarSpa, company.BusinessType);
        Assert.Equal(company.Id, tenant.OrganizationId);
        Assert.Equal("owner1", owner.Username);
        Assert.Equal(company.Id, (await db.Users.SingleAsync()).OrganizationId);
        Assert.True((await auth.GetStatusAsync()).Initialized);

        await Assert.ThrowsAsync<ConflictException>(() => auth.BootstrapOwnerAsync(new BootstrapOwnerRequest
        {
            FullName = "Second", Username = "Owner2", Password = "Strong#Pass2026x", ConfirmPassword = "Strong#Pass2026x"
        }));
    }

    [Theory]
    [InlineData(BusinessType.CarSpa, 1, "01-0001")]
    [InlineData(BusinessType.CarSpa, 42, "01-0042")]
    public void CompanyCodes_AreTheBusinessTypeThenARunningNumber(BusinessType type, int number, string expected)
    {
        Assert.Equal(expected, Organization.FormatCode(type, number));
        Assert.Equal(DefaultOrganization.Code, Organization.FormatCode(BusinessType.CarSpa, 1));
    }
}
