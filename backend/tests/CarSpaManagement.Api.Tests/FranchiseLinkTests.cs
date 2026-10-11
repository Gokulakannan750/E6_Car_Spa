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

    private sealed class FakeFigures : IFranchiseFigures
    {
        public Dictionary<Guid, FranchiseFinancialTotalsDto> Totals { get; } = new();
        public List<Guid> Asked { get; } = [];

        public Task<FranchiseFinancialTotalsDto> GetFinancialTotalsAsync(Guid franchiseeOrganizationId, DateOnly from, DateOnly to,
            CancellationToken cancellationToken = default)
        {
            Asked.Add(franchiseeOrganizationId);
            return Task.FromResult(Totals[franchiseeOrganizationId]);
        }
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

        public (FranchiseService Service, AppDbContext Db) As(Guid company, bool addOn = true, IFranchiseFigures? figures = null)
        {
            var db = Db(company);
            return (new FranchiseService(db, new NoAudit(), new Entitlement(addOn), new HttpContextAccessor(), figures ?? new FakeFigures(),
                new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build()), db);
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
        var asked = (await alpha.RequestScopesAsync(link.Id, new RequestFranchiseScopesRequest { Scopes = ["invoice_list"] })).Link;
        Assert.Equal("Requested", asked.Scopes.Single(s => s.Scope == "invoice_list").Status);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            alpha.DecideScopeAsync(link.Id, "invoice_list", new DecideFranchiseScopeRequest { Grant = true }));

        var granted = await beta.DecideScopeAsync(link.Id, "invoice_list", new DecideFranchiseScopeRequest { Grant = true });
        Assert.Equal("Granted", granted.Scopes.Single(s => s.Scope == "invoice_list").Status);

        var off = await beta.DecideScopeAsync(link.Id, "financial_totals", new DecideFranchiseScopeRequest { Grant = false });
        Assert.Equal("Denied", off.Scopes.Single(s => s.Scope == "financial_totals").Status);

        // The franchisor can ask again for something that was switched off.
        var (alphaLater, _) = world.As(Org1);
        var again = (await alphaLater.RequestScopesAsync(link.Id, new RequestFranchiseScopesRequest { Scopes = ["financial_totals"] })).Link;
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

    // ── The link the franchisee answers through ─────────────────────────────────────────────────────────────

    private static string TokenOf(string link) => link[(link.LastIndexOf('/') + 1)..];

    private static async Task<(FranchiseLinkDto Link, string Token)> InviteWithLinkAsync(World world, Guid from, string code, List<string>? scopes = null)
    {
        var (franchisor, _) = world.As(from);
        var response = await franchisor.SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = code, Scopes = scopes });
        var network = await world.As(from).Service.GetNetworkAsync();
        return (network.Franchisees.First(l => l.PartnerCodeHint == FranchiseService.MaskCode(code) && l.Status == "Pending"), TokenOf(response.InviteLink));
    }

    [Fact]
    public async Task AnInvitation_ComesWithALinkToPassOn_AndAnUnknownCodeGetsAnIdenticalLookingOne()
    {
        var world = new World();
        var (alpha, _) = world.As(Org1);

        var real = await alpha.SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = "0002" });
        var fake = await alpha.SendInviteAsync(new SendFranchiseInviteRequest { FranchiseeCode = "9999" });

        Assert.Matches("^http://localhost:5173/franchise-invite/[0-9a-f]{64}$", real.InviteLink);
        Assert.Matches("^http://localhost:5173/franchise-invite/[0-9a-f]{64}$", fake.InviteLink);
        Assert.Equal(real.Message, fake.Message);
        Assert.Single((await alpha.GetNetworkAsync()).Franchisees);

        // The made-up link opens nothing for anybody.
        await Assert.ThrowsAsync<NotFoundException>(() => world.As(Org2).Service.GetByTokenAsync(TokenOf(fake.InviteLink)));
    }

    [Fact]
    public async Task OnlyTheInvitedCompany_CanOpenTheLink()
    {
        var world = new World();
        var (_, token) = await InviteWithLinkAsync(world, Org1, "0002", ["financial_totals", "staff"]);

        var opened = await world.As(Org2).Service.GetByTokenAsync(token);
        Assert.Equal("Franchisee", opened.Role);
        Assert.Equal("Alpha Car Spa", opened.PartnerName);
        Assert.Equal(2, opened.Scopes.Count);

        // Anybody else holding the link gets the same answer as for a link that does not exist.
        await Assert.ThrowsAsync<NotFoundException>(() => world.As(Org3).Service.GetByTokenAsync(token));
        await Assert.ThrowsAsync<NotFoundException>(() => world.As(Org1).Service.GetByTokenAsync(token));
        await Assert.ThrowsAsync<NotFoundException>(() => world.As(Org2).Service.GetByTokenAsync(new string('a', 64)));
    }

    [Fact]
    public async Task AnsweringThroughTheLink_ActivatesTheLink_AndUsesTheLinkUp()
    {
        var world = new World();
        var (link, token) = await InviteWithLinkAsync(world, Org1, "0002", ["financial_totals", "staff"]);

        var accepted = await world.As(Org2).Service.RespondByTokenAsync(token, Accept("financial_totals"));
        Assert.Equal("Active", accepted.Status);
        Assert.Equal("Granted", accepted.Scopes.Single(s => s.Scope == "financial_totals").Status);
        Assert.Equal("Denied", accepted.Scopes.Single(s => s.Scope == "staff").Status);

        // It cannot be used twice, and the franchisor sees the link as active.
        await Assert.ThrowsAsync<NotFoundException>(() => world.As(Org2).Service.GetByTokenAsync(token));
        await Assert.ThrowsAsync<NotFoundException>(() => world.As(Org2).Service.RespondByTokenAsync(token, Accept("financial_totals")));
        Assert.Equal("Active", (await world.As(Org1).Service.GetNetworkAsync()).Franchisees.Single(l => l.Id == link.Id).Status);
    }

    [Fact]
    public async Task DecliningThroughTheLink_EndsTheInvitation()
    {
        var world = new World();
        var (_, token) = await InviteWithLinkAsync(world, Org1, "0002");

        var declined = await world.As(Org2).Service.RespondByTokenAsync(token, new RespondToFranchiseInviteRequest { Accept = false });
        Assert.Equal("Declined", declined.Status);
        await Assert.ThrowsAsync<NotFoundException>(() => world.As(Org2).Service.GetByTokenAsync(token));
    }

    [Fact]
    public async Task ALinkThatExpired_OrWasWithdrawn_OpensNothing()
    {
        var world = new World();
        var (link, token) = await InviteWithLinkAsync(world, Org1, "0002");
        await using (var db = world.Db(Org1))
        {
            var row = await db.FranchiseLinks.SingleAsync();
            row.InviteTokenExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }
        await Assert.ThrowsAsync<NotFoundException>(() => world.As(Org2).Service.GetByTokenAsync(token));

        var second = new World();
        var (withdrawn, token2) = await InviteWithLinkAsync(second, Org1, "0002");
        await second.As(Org1).Service.CancelInviteAsync(withdrawn.Id);
        await Assert.ThrowsAsync<NotFoundException>(() => second.As(Org2).Service.GetByTokenAsync(token2));
        Assert.NotEqual(link.Id, withdrawn.Id);
    }

    [Fact]
    public async Task ANewLink_ReplacesTheOldOne_AndOnlyTheFranchisorCanMakeIt()
    {
        var world = new World();
        var (link, oldToken) = await InviteWithLinkAsync(world, Org1, "0002");

        await Assert.ThrowsAsync<ForbiddenException>(() => world.As(Org2).Service.CreateLinkAsync(link.Id));
        await Assert.ThrowsAsync<NotFoundException>(() => world.As(Org3).Service.CreateLinkAsync(link.Id));

        var fresh = await world.As(Org1).Service.CreateLinkAsync(link.Id);
        var newToken = TokenOf(fresh.AccessLink!);
        Assert.NotEqual(oldToken, newToken);

        await Assert.ThrowsAsync<NotFoundException>(() => world.As(Org2).Service.GetByTokenAsync(oldToken));
        Assert.Equal("Pending", (await world.As(Org2).Service.GetByTokenAsync(newToken)).Status);
    }

    [Fact]
    public async Task AskingForMore_ComesWithALink_AndTheFranchiseeAllowsSomeOfIt()
    {
        var world = new World();
        var (link, token) = await InviteWithLinkAsync(world, Org1, "0002");
        await world.As(Org2).Service.RespondByTokenAsync(token, Accept("financial_totals"));

        // A link is only made when something is asked, and there is nothing waiting yet.
        await Assert.ThrowsAsync<ConflictException>(() => world.As(Org1).Service.CreateLinkAsync(link.Id));

        var asked = await world.As(Org1).Service.RequestScopesAsync(link.Id, new RequestFranchiseScopesRequest { Scopes = ["invoice_list", "staff"] });
        var requestToken = TokenOf(asked.AccessLink!);
        Assert.NotNull(asked.AccessLinkExpiresAt);

        var opened = await world.As(Org2).Service.GetByTokenAsync(requestToken);
        Assert.Equal("Active", opened.Status);
        Assert.Equal(2, opened.Scopes.Count(s => s.Status == "Requested"));

        var answered = await world.As(Org2).Service.RespondByTokenAsync(requestToken, Accept("invoice_list"));
        Assert.Equal("Granted", answered.Scopes.Single(s => s.Scope == "invoice_list").Status);
        Assert.Equal("Denied", answered.Scopes.Single(s => s.Scope == "staff").Status);
        Assert.Equal("Granted", answered.Scopes.Single(s => s.Scope == "financial_totals").Status);
        await Assert.ThrowsAsync<NotFoundException>(() => world.As(Org2).Service.GetByTokenAsync(requestToken));
    }

    [Fact]
    public async Task TheFranchiseSectionIsOnlyForCompaniesWithTheAddOn_ButAFranchiseeNeedsNone()
    {
        var world = new World();
        await using (var db = world.Db(null))
        {
            (await db.Organizations.SingleAsync(o => o.Id == Org1)).FranchiseAddOnEnabled = true;
            await db.SaveChangesAsync();
        }

        FranchiseAccessDto Access(Guid company) => AccessOf(world, company).GetAwaiter().GetResult();

        Assert.True(Access(Org1).CanActAsFranchisor);
        Assert.False(Access(Org2).CanActAsFranchisor);
        Assert.False(Access(Org2).IsFranchisee);

        var (_, token) = await InviteWithLinkAsync(world, Org1, "0002");
        await world.As(Org2).Service.RespondByTokenAsync(token, Accept("financial_totals"));

        Assert.True(Access(Org2).IsFranchisee);
        Assert.False(Access(Org2).CanActAsFranchisor);   // answering and managing sharing needs no add-on
        Assert.False(Access(Org1).IsFranchisee);
    }

    private static async Task<FranchiseAccessDto> AccessOf(World world, Guid company)
    {
        await using var db = world.Db(company);
        var service = new FranchiseService(db, new NoAudit(), new OrganizationFranchiseEntitlement(db), new HttpContextAccessor(),
            new FakeFigures(), new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build());
        return await service.GetAccessAsync();
    }

    // ── The franchisor's dashboard ──────────────────────────────────────────────────────────────────────────

    private static FranchiseFinancialTotalsDto Totals(int invoices, decimal invoiced, decimal collected, decimal outstanding, int jobs,
        params (string date, decimal invoiced, decimal collected)[] daily) =>
        new(invoices, invoiced, collected, outstanding, jobs, daily.Select(d => new FranchiseDailyPointDto(d.date, d.invoiced, d.collected)).ToList());

    [Fact]
    public async Task TheDashboard_ShowsOnlyActiveFranchisees_AndOnlyWhatIsAllowed_AndAddsUpTheNetwork()
    {
        var world = new World();
        var figures = new FakeFigures();
        figures.Totals[Org2] = Totals(3, 1000m, 600m, 400m, 4, ("2026-10-01", 600m, 300m), ("2026-10-02", 400m, 300m));
        figures.Totals[Org3] = Totals(1, 250m, 250m, 0m, 1, ("2026-10-02", 250m, 250m));

        // Beta accepts and shares the totals; Gamma accepts but shares something else only.
        var toBeta = await InviteAsync(world, Org1, "0002");
        await world.As(Org2).Service.RespondAsync(toBeta.Id, Accept("financial_totals"));
        var toGamma = await InviteAsync(world, Org1, "0003", ["financial_totals", "staff"]);
        await world.As(Org3).Service.RespondAsync(toGamma.Id, Accept("staff"));

        var (alpha, _) = world.As(Org1, figures: figures);
        var dashboard = await alpha.GetDashboardAsync(new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 7));

        Assert.Equal(2, dashboard.Franchisees.Count);
        var beta = dashboard.Franchisees.Single(f => f.PartnerName == "Beta Detailing");
        Assert.True(beta.FinancialTotalsAllowed);
        Assert.Equal(1000m, beta.Totals!.InvoicedAmount);
        var gamma = dashboard.Franchisees.Single(f => f.PartnerName == "Gamma Wash");
        Assert.False(gamma.FinancialTotalsAllowed);
        Assert.Null(gamma.Totals);
        Assert.Equal([Org2], figures.Asked);                 // nothing was even requested for Gamma

        Assert.Equal(3, dashboard.Network.InvoiceCount);
        Assert.Equal(1000m, dashboard.Network.InvoicedAmount);
        Assert.Equal(["2026-10-01", "2026-10-02"], dashboard.Network.Daily.Select(d => d.Date));
        Assert.Equal(400m, dashboard.Network.Daily.Single(d => d.Date == "2026-10-02").Invoiced);
        Assert.Equal("2026-10-01", dashboard.From);
        Assert.Equal("2026-10-07", dashboard.To);
    }

    [Fact]
    public async Task APendingOrEndedLink_ShowsNothingOnTheDashboard_AndTheFranchiseeSeesNoOneElsesFigures()
    {
        var world = new World();
        var figures = new FakeFigures();
        figures.Totals[Org2] = Totals(1, 10m, 10m, 0m, 1);

        var link = await InviteAsync(world, Org1, "0002");
        var (alpha, _) = world.As(Org1, figures: figures);
        Assert.Empty((await alpha.GetDashboardAsync(null, null)).Franchisees);   // still pending

        await world.As(Org2).Service.RespondAsync(link.Id, Accept("financial_totals"));
        Assert.Single((await world.As(Org1, figures: figures).Service.GetDashboardAsync(null, null)).Franchisees);

        // The franchisee has no franchisees of its own, so its dashboard is empty.
        Assert.Empty((await world.As(Org2, figures: figures).Service.GetDashboardAsync(null, null)).Franchisees);

        await world.As(Org2).Service.EndLinkAsync(link.Id);
        Assert.Empty((await world.As(Org1, figures: figures).Service.GetDashboardAsync(null, null)).Franchisees);
    }

    [Fact]
    public async Task TheDashboardPeriod_IsValidated_AndNeedsTheAddOn()
    {
        var world = new World();
        var (alpha, _) = world.As(Org1);
        await Assert.ThrowsAsync<ValidationException>(() => alpha.GetDashboardAsync(new DateOnly(2026, 10, 9), new DateOnly(2026, 10, 1)));
        await Assert.ThrowsAsync<ValidationException>(() => alpha.GetDashboardAsync(new DateOnly(2024, 1, 1), new DateOnly(2026, 10, 1)));

        var (noAddOn, _) = world.As(Org1, addOn: false);
        await Assert.ThrowsAsync<ForbiddenException>(() => noAddOn.GetDashboardAsync(null, null));
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
