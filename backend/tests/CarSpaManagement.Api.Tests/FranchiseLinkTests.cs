using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Franchise;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>The franchise link between two companies: invite, answer, permissions, ending, and who can see what.</summary>
public class FranchiseLinkTests
{
    private static readonly Guid Org1 = Guid.Parse("11111111-0000-0000-0000-000000000001");
    private static readonly Guid Org2 = Guid.Parse("22222222-0000-0000-0000-000000000002");
    private static readonly Guid Org3 = Guid.Parse("33333333-0000-0000-0000-000000000003");

    private sealed class NoAudit : IAuditLogService
    {
        public Task RecordAsync(string action, string module, string description, Guid? userId = null, string? userName = null,
            string? userRole = null, string? entityType = null, Guid? entityId = null, string? entityReference = null,
            string? oldValues = null, string? newValues = null, string? metadata = null, string outcome = "Success",
            CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<CarSpaManagement.Api.Application.DTOs.Audit.PagedResult<CarSpaManagement.Api.Application.DTOs.Audit.AuditLogDto>> GetLogsAsync(
            CarSpaManagement.Api.Application.DTOs.Audit.AuditLogQueryParameters query, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();
    }

    private sealed class Entitlement(bool enabled) : IFranchiseEntitlement
    {
        public Task<bool> IsEnabledAsync(CancellationToken cancellationToken = default) => Task.FromResult(enabled);
    }

    private sealed class World
    {
        private readonly string _name = Guid.NewGuid().ToString();

        public World()
        {
            using var db = Db(null);
            db.Organizations.AddRange(
                new Organization { Id = Org1, Code = "0001", Name = "Alpha Car Spa", IsActive = true },
                new Organization { Id = Org2, Code = "0002", Name = "Beta Detailing", IsActive = true },
                new Organization { Id = Org3, Code = "0003", Name = "Gamma Wash", IsActive = true });
            db.SaveChanges();
        }

        public AppDbContext Db(Guid? company)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(_name)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options, company is { } c ? new FixedTenantContext(c) : NoTenantContext.Instance);
        }

        public (FranchiseService Service, AppDbContext Db) As(Guid company, bool addOn = true)
        {
            var db = Db(company);
            return (new FranchiseService(db, new NoAudit(), new Entitlement(addOn), new HttpContextAccessor()), db);
        }
    }

    private static async Task<FranchiseLinkDto> InviteAsync(World world, Guid from, string code, List<string>? scopes = null)
    {
        var (franchisor, _) = world.As(from);
        await franchisor.SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = code, Scopes = scopes });
        var network = await franchisor.GetNetworkAsync();
        return network.Franchisees.First(l => l.PartnerCodeHint == FranchiseService.MaskCode(code) && l.Status == "Pending");
    }

    private static RespondToFranchiseInviteRequest Accept(params string[] scopes) =>
        new() { Accept = true, GrantedScopes = scopes.ToList() };

    // ── Inviting ────────────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task AnInvitation_IsSeenByBothCompanies_AndByNobodyElse()
    {
        var world = new World();
        var link = await InviteAsync(world, Org1, "0002");
        Assert.Equal("Pending", link.Status);
        Assert.Equal("Franchisor", link.Role);
        Assert.Equal("Beta Detailing", link.PartnerName);
        Assert.Equal("0••2", link.PartnerCodeHint);
        Assert.DoesNotContain("0002", System.Text.Json.JsonSerializer.Serialize(link));
        Assert.Equal(["financial_totals"], link.Scopes.Select(s => s.Scope));

        var (beta, _) = world.As(Org2);
        var network = await beta.GetNetworkAsync();
        var seen = Assert.Single(network.Franchisors);
        Assert.Equal("Franchisee", seen.Role);
        Assert.Equal("Alpha Car Spa", seen.PartnerName);
        Assert.Equal(1, network.PendingInvitations);

        var (gamma, _) = world.As(Org3);
        var outsider = await gamma.GetNetworkAsync();
        Assert.Empty(outsider.Franchisees);
        Assert.Empty(outsider.Franchisors);
    }

    [Fact]
    public async Task InvitingAnUnknownCode_GivesTheSameAnswer_AndCreatesNothing()
    {
        var world = new World();
        var (alpha, _) = world.As(Org1);

        var known = await alpha.SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = "0002" });
        var unknown = await alpha.SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = "9999" });
        var self = await alpha.SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = "0001" });

        Assert.Equal(known.Message, unknown.Message);
        Assert.Equal(known.Message, self.Message);
        Assert.Single((await alpha.GetNetworkAsync()).Franchisees);
    }

    [Fact]
    public async Task InvitingTheSameCompanyTwice_DoesNotCreateASecondOpenLink()
    {
        var world = new World();
        await InviteAsync(world, Org1, "0002");
        var (alpha, _) = world.As(Org1);
        await alpha.SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = "0002" });

        Assert.Single((await alpha.GetNetworkAsync()).Franchisees);
    }

    [Fact]
    public async Task OnlyKnownItems_CanBeAskedFor()
    {
        var world = new World();
        var (alpha, _) = world.As(Org1);
        await Assert.ThrowsAsync<ValidationException>(() =>
            alpha.SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = "0002", Scopes = ["everything"] }));
    }

    [Fact]
    public async Task WithoutTheFranchiseAddOn_ACompanyCannotInvite_ButCanStillAnswerAnInvitation()
    {
        var world = new World();
        var (noAddOn, _) = world.As(Org3, addOn: false);
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            noAddOn.SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = "0001" }));

        var link = await InviteAsync(world, Org1, "0003");
        var accepted = await noAddOn.RespondAsync(link.Id, Accept("financial_totals"));
        Assert.Equal("Active", accepted.Status);
    }

    [Fact]
    public async Task ACompany_CanSendOnlyALimitedNumberOfInvitationsADay()
    {
        var world = new World();
        await using (var db = world.Db(null))
        {
            for (var i = 0; i < FranchiseService.MaxInvitesPerDay; i++)
            {
                db.Organizations.Add(new Organization { Code = $"X{i:000}", Name = "x", IsActive = true });
            }
            await db.SaveChangesAsync();
        }

        var (alpha, _) = world.As(Org1);
        for (var i = 0; i < FranchiseService.MaxInvitesPerDay; i++)
        {
            await alpha.SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = $"X{i:000}" });
        }

        await Assert.ThrowsAsync<ConflictException>(() =>
            alpha.SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = "0002" }));
    }

    // ── Answering ───────────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task AcceptingActivatesTheLink_AndOnlyTheAllowedItemsAreGranted()
    {
        var world = new World();
        var link = await InviteAsync(world, Org1, "0002", ["financial_totals", "staff"]);

        var (beta, _) = world.As(Org2);
        var accepted = await beta.RespondAsync(link.Id, Accept("financial_totals"));

        Assert.Equal("Active", accepted.Status);
        Assert.Equal("Granted", accepted.Scopes.Single(s => s.Scope == "financial_totals").Status);
        Assert.Equal("Denied", accepted.Scopes.Single(s => s.Scope == "staff").Status);

        var (alpha, _) = world.As(Org1);
        var seenByAlpha = (await alpha.GetNetworkAsync()).Franchisees.Single();
        Assert.Equal("Active", seenByAlpha.Status);
        Assert.Equal("Granted", seenByAlpha.Scopes.Single(s => s.Scope == "financial_totals").Status);
    }

    [Fact]
    public async Task AcceptingRequiresAtLeastOneItem_AndOnlyItemsThatWereAskedFor()
    {
        var world = new World();
        var link = await InviteAsync(world, Org1, "0002");
        var (beta, _) = world.As(Org2);

        await Assert.ThrowsAsync<ValidationException>(() => beta.RespondAsync(link.Id, Accept()));
        await Assert.ThrowsAsync<ValidationException>(() => beta.RespondAsync(link.Id, Accept("customers")));
    }

    [Fact]
    public async Task DecliningEndsTheInvitation_AndTheFranchisorCanInviteAgain()
    {
        var world = new World();
        var link = await InviteAsync(world, Org1, "0002");
        var (beta, _) = world.As(Org2);

        var declined = await beta.RespondAsync(link.Id, new RespondToFranchiseInviteRequest { Accept = false });
        Assert.Equal("Declined", declined.Status);
        Assert.All(declined.Scopes, s => Assert.Equal("Denied", s.Status));

        var (alpha, _) = world.As(Org1);
        await alpha.SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = "0002" });
        Assert.Equal(2, (await alpha.GetNetworkAsync()).Franchisees.Count);
    }

    [Fact]
    public async Task OnlyTheInvitedCompany_CanAnswer_AndOnlyTheInviterCanWithdraw()
    {
        var world = new World();
        var link = await InviteAsync(world, Org1, "0002");

        var (alpha, _) = world.As(Org1);
        await Assert.ThrowsAsync<ForbiddenException>(() => alpha.RespondAsync(link.Id, Accept("financial_totals")));

        var (gamma, _) = world.As(Org3);
        await Assert.ThrowsAsync<NotFoundException>(() => gamma.RespondAsync(link.Id, Accept("financial_totals")));
        await Assert.ThrowsAsync<NotFoundException>(() => gamma.CancelInviteAsync(link.Id));

        var (beta, _) = world.As(Org2);
        await Assert.ThrowsAsync<ForbiddenException>(() => beta.CancelInviteAsync(link.Id));

        var cancelled = await alpha.CancelInviteAsync(link.Id);
        Assert.Equal("Cancelled", cancelled.Status);

        // A new request is a new database context, so it sees the current state.
        var (betaLater, _) = world.As(Org2);
        await Assert.ThrowsAsync<ConflictException>(() => betaLater.RespondAsync(link.Id, Accept("financial_totals")));
    }

    [Fact]
    public async Task AnUnansweredInvitation_Expires()
    {
        var world = new World();
        var link = await InviteAsync(world, Org1, "0002");
        await using (var db = world.Db(Org1))
        {
            var row = await db.FranchiseLinks.SingleAsync();
            row.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        var (beta, _) = world.As(Org2);
        await Assert.ThrowsAsync<ConflictException>(() => beta.RespondAsync(link.Id, Accept("financial_totals")));
        Assert.Equal("Expired", (await beta.GetNetworkAsync()).Franchisors.Single().Status);
        Assert.Equal(0, (await beta.GetNetworkAsync()).PendingInvitations);
    }

    // ── Permissions and ending ──────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task TheFranchisorCanAskForMore_AndTheFranchiseeDecidesAndCanSwitchItOffAgain()
    {
        var world = new World();
        var link = await InviteAsync(world, Org1, "0002");
        var (beta, _) = world.As(Org2);
        await beta.RespondAsync(link.Id, Accept("financial_totals"));

        var (alpha, _) = world.As(Org1);
        var asked = await alpha.RequestScopesAsync(link.Id, new RequestFranchiseScopesRequest { Scopes = ["invoice_list"] });
        Assert.Equal("Requested", asked.Scopes.Single(s => s.Scope == "invoice_list").Status);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            alpha.DecideScopeAsync(link.Id, "invoice_list", new DecideFranchiseScopeRequest { Grant = true }));

        var granted = await beta.DecideScopeAsync(link.Id, "invoice_list", new DecideFranchiseScopeRequest { Grant = true });
        Assert.Equal("Granted", granted.Scopes.Single(s => s.Scope == "invoice_list").Status);

        var off = await beta.DecideScopeAsync(link.Id, "financial_totals", new DecideFranchiseScopeRequest { Grant = false });
        Assert.Equal("Denied", off.Scopes.Single(s => s.Scope == "financial_totals").Status);

        // The franchisor can ask again for something that was switched off.
        var (alphaLater, _) = world.As(Org1);
        var again = await alphaLater.RequestScopesAsync(link.Id, new RequestFranchiseScopesRequest { Scopes = ["financial_totals"] });
        Assert.Equal("Requested", again.Scopes.Single(s => s.Scope == "financial_totals").Status);
    }

    [Fact]
    public async Task TheFranchisee_CannotRequestAccessForTheFranchisor()
    {
        var world = new World();
        var link = await InviteAsync(world, Org1, "0002");
        var (beta, _) = world.As(Org2);
        await beta.RespondAsync(link.Id, Accept("financial_totals"));

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            beta.RequestScopesAsync(link.Id, new RequestFranchiseScopesRequest { Scopes = ["staff"] }));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public async Task EitherCompany_CanEndAnActiveLink(int endedBy)
    {
        var world = new World();
        var link = await InviteAsync(world, Org1, "0002");
        var (beta, _) = world.As(Org2);
        await beta.RespondAsync(link.Id, Accept("financial_totals"));

        var (ender, _) = world.As(endedBy == 1 ? Org1 : Org2);
        var ended = await ender.EndLinkAsync(link.Id);
        Assert.Equal("Ended", ended.Status);
        await Assert.ThrowsAsync<ConflictException>(() => ender.EndLinkAsync(link.Id));

        // After it ended, the pair can be invited again.
        var (alpha, _) = world.As(Org1);
        await alpha.SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = "0002" });
        Assert.Equal(2, (await alpha.GetNetworkAsync()).Franchisees.Count);
    }

    // ── The write guard ─────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ACompanyThatIsNotPartOfALink_CannotChangeIt_EvenIfCodeGetsHoldOfIt()
    {
        var world = new World();
        var link = await InviteAsync(world, Org1, "0002");

        await using var outsider = world.Db(Org3);
        var stolen = new FranchiseLink
        {
            Id = link.Id, FranchisorOrganizationId = Org1, FranchiseeOrganizationId = Org2, Status = FranchiseLinkStatus.Active,
            ExpiresAt = DateTime.UtcNow.AddDays(1)
        };
        outsider.FranchiseLinks.Attach(stolen);
        outsider.Entry(stolen).Property(l => l.Status).IsModified = true;
        await Assert.ThrowsAsync<TenantViolationException>(() => outsider.SaveChangesAsync());
    }

    [Fact]
    public async Task OnlyTheInvitingCompany_CanCreateALink_AndTheCompaniesOfALinkNeverChange()
    {
        var world = new World();

        await using (var beta = world.Db(Org2))
        {
            beta.FranchiseLinks.Add(new FranchiseLink
            {
                FranchisorOrganizationId = Org1, FranchiseeOrganizationId = Org2, ExpiresAt = DateTime.UtcNow.AddDays(1)
            });
            await Assert.ThrowsAsync<TenantViolationException>(() => beta.SaveChangesAsync());
        }

        var link = await InviteAsync(world, Org1, "0002");
        await using var alpha = world.Db(Org1);
        var row = await alpha.FranchiseLinks.SingleAsync(l => l.Id == link.Id);
        row.FranchiseeOrganizationId = Org3;
        await Assert.ThrowsAsync<TenantViolationException>(() => alpha.SaveChangesAsync());
    }

    [Fact]
    public void FranchiseLinks_AreNotOwnedByOneCompany_SoTheyAreListedAsSharedTables()
    {
        Assert.False(typeof(IOrganizationOwned).IsAssignableFrom(typeof(FranchiseLink)));
        Assert.False(typeof(IOrganizationOwned).IsAssignableFrom(typeof(FranchiseLinkScope)));
    }
}
