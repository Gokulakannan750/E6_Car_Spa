using CarSpaManagement.Api.Infrastructure.Tenancy;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Settings;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>Invoice Configuration settings: both series visible, prefixes editable by the Owner only, counters read-only.</summary>
public class InvoiceSeriesSettingsTests
{
    private sealed record Env(AppDbContext Db, RecordingAuditLogService Audit, User Owner, User Manager, User Staff)
    {
        public InvoiceSeriesService As(User? user)
        {
            var http = new DefaultHttpContext();
            if (user is not null)
                http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), new Claim(JwtTokenService.OrganizationClaim, DefaultOrganization.Id.ToString())], "Test"));
            return new InvoiceSeriesService(Db, Audit, new HttpContextAccessor { HttpContext = http });
        }
    }

    private static async Task<Env> CreateAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        var owner = new User { FullName = "Owner", Username = "owner", Role = UserRole.Owner, IsActive = true, PasswordHash = "x" };
        var manager = new User { FullName = "Manager", Username = "manager", Role = UserRole.Manager, IsActive = true, PasswordHash = "x" };
        var staff = new User { FullName = "Staff", Username = "staff", Role = UserRole.Staff, IsActive = true, PasswordHash = "x" };
        db.Users.AddRange(owner, manager, staff);
        await db.SaveChangesAsync();
        return new Env(db, new RecordingAuditLogService(), owner, manager, staff);
    }

    [Fact]
    public async Task Get_ReturnsBothSeriesWithDefaults_AndReadOnlyNextNumbers()
    {
        var env = await CreateAsync();
        var dto = await env.As(env.Staff).GetAsync();

        Assert.Equal("Gst", dto.Gst.SeriesKind);
        Assert.Equal("GST/", dto.Gst.Prefix);
        Assert.Equal(1, dto.Gst.NextNumber);
        Assert.Equal("0001", dto.Gst.NextNumberDisplay);
        Assert.Equal("GST/0001", dto.Gst.NextInvoiceNumber);
        Assert.Equal("BILL/", dto.NonGst.Prefix);
        Assert.Equal("BILL/0001", dto.NonGst.NextInvoiceNumber);
        Assert.Equal(4, dto.NonGst.MinDigits);
    }

    [Fact]
    public async Task Owner_CanChangePrefixes_ItIsAudited_AndCountersAreUnchanged()
    {
        var env = await CreateAsync();
        var before = await env.As(env.Owner).GetAsync();

        var dto = await env.As(env.Owner).UpdatePrefixesAsync(new UpdateInvoiceSeriesRequest(" tax/ ", "inv-"));

        Assert.Equal("TAX/", dto.Gst.Prefix);           // trimmed and upper-cased
        Assert.Equal("INV-", dto.NonGst.Prefix);
        Assert.Equal("TAX/0001", dto.Gst.NextInvoiceNumber);
        Assert.Equal(before.Gst.NextNumber, dto.Gst.NextNumber);
        Assert.Equal(before.NonGst.NextNumber, dto.NonGst.NextNumber);
        var entry = Assert.Single(env.Audit.Entries, e => e.Action == AuditActions.InvoiceSeriesPrefixChanged);
        Assert.Equal("Success", entry.Outcome);
    }

    [Fact]
    public async Task Owner_CanSwapPrefixes()
    {
        var env = await CreateAsync();
        var dto = await env.As(env.Owner).UpdatePrefixesAsync(new UpdateInvoiceSeriesRequest("BILL/", "GST/"));
        Assert.Equal("BILL/", dto.Gst.Prefix);
        Assert.Equal("GST/", dto.NonGst.Prefix);
    }

    [Fact]
    public async Task UnchangedPrefixes_AreNotAudited()
    {
        var env = await CreateAsync();
        await env.As(env.Owner).UpdatePrefixesAsync(new UpdateInvoiceSeriesRequest("GST/", "BILL/"));
        Assert.DoesNotContain(env.Audit.Entries, e => e.Action == AuditActions.InvoiceSeriesPrefixChanged);
    }

    [Fact]
    public async Task Manager_Staff_AndAnonymous_CannotChangePrefixes()
    {
        var env = await CreateAsync();
        foreach (var caller in new[] { env.Manager, env.Staff, null })
        {
            await Assert.ThrowsAsync<ForbiddenException>(() =>
                env.As(caller).UpdatePrefixesAsync(new UpdateInvoiceSeriesRequest("HACK/", "BILL/")));
        }
        Assert.Equal("GST/", (await env.As(env.Owner).GetAsync()).Gst.Prefix);
    }

    [Theory]
    [InlineData("", "BILL/")]
    [InlineData("GST /", "BILL/")]
    [InlineData("GST#", "BILL/")]
    [InlineData("ABCDEFGHIJK", "BILL/")] // 11 characters
    [InlineData("GST/", "gst/")]         // must differ (case-insensitive)
    public async Task InvalidPrefixes_AreRejected(string gst, string nonGst)
    {
        var env = await CreateAsync();
        await Assert.ThrowsAsync<ArgumentException>(() =>
            env.As(env.Owner).UpdatePrefixesAsync(new UpdateInvoiceSeriesRequest(gst, nonGst)));
    }

    [Fact]
    public async Task PrefixEndingInDigit_IsAllowed()
    {
        var env = await CreateAsync();
        var dto = await env.As(env.Owner).UpdatePrefixesAsync(new UpdateInvoiceSeriesRequest("E6", "E6B"));
        Assert.Equal("E60001", dto.Gst.NextInvoiceNumber);
    }

    [Fact]
    public async Task NextNumberPreview_SkipsNumbersAlreadyReserved()
    {
        var env = await CreateAsync();
        var invoice = new Invoice { InvoiceNumber = "GST/0001", IsGstEnabled = true, Status = InvoiceStatus.Paid };
        env.Db.Invoices.Add(invoice);
        env.Db.InvoiceNumberAllocations.Add(new InvoiceNumberAllocation
        {
            InvoiceId = invoice.Id, InvoiceNumber = "GST/0001", NormalizedNumber = "GST/0001",
            SeriesKind = InvoiceSeriesKind.Gst, AllocationType = InvoiceNumberAllocationType.Manual,
        });
        await env.Db.SaveChangesAsync();

        var dto = await env.As(env.Owner).GetAsync();
        Assert.Equal("GST/0002", dto.Gst.NextInvoiceNumber);
    }
}

/// <summary>Invoice Configuration over HTTP through the real API pipeline (real PostgreSQL).</summary>
public class InvoiceSeriesSettingsHttpTests : IClassFixture<ApiTestHost>
{
    private readonly ApiTestHost _api;
    public InvoiceSeriesSettingsHttpTests(ApiTestHost api) => _api = api;

    private Task<HttpResponseMessage> Put(string? asUser, string gst, string nonGst) =>
        _api.SendAsync(HttpMethod.Put, "/api/settings/invoice-series", asUser, new { gstPrefix = gst, nonGstPrefix = nonGst });

    private async Task<string> AddUserWithSettingsViewAsync()
    {
        using var scope = _api.Services.CreateTestScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var name = $"settings.viewer.{Guid.NewGuid():N}"[..24];
        var permission = await db.Permissions.SingleAsync(p => p.Code == "settings.view");
        var user = new User { FullName = name, Username = name, Role = UserRole.Manager, IsActive = true, PasswordHash = "x" };
        user.UserPermissions.Add(new UserPermission { UserId = user.Id, PermissionId = permission.Id });
        db.Users.Add(user);
        await db.SaveChangesAsync();
        _api.Users[name] = user;
        return name;
    }

    [PostgresFact]
    public async Task Get_RequiresSettingsView()
    {
        var viewer = await AddUserWithSettingsViewAsync();
        var ok = await _api.SendAsync(HttpMethod.Get, "/api/settings/invoice-series", viewer);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var dto = await ok.Content.ReadFromJsonAsync<InvoiceSeriesSettingsDto>();
        Assert.NotNull(dto);
        Assert.Equal(4, dto!.Gst.MinDigits);

        Assert.Equal(HttpStatusCode.Forbidden, (await _api.SendAsync(HttpMethod.Get, "/api/settings/invoice-series", "staff.viewer")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _api.SendAsync(HttpMethod.Get, "/api/settings/invoice-series", null)).StatusCode);
    }

    [PostgresFact]
    public async Task Put_IsOwnerOnly()
    {
        var viewer = await AddUserWithSettingsViewAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await Put("manager.a", "HACK/", "BILL/")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Put("staff.viewer", "HACK/", "BILL/")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Put(viewer, "HACK/", "BILL/")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Put(null, "HACK/", "BILL/")).StatusCode);

        var ok = await Put("owner", "GST/", "BILL/");
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
    }

    [PostgresFact]
    public async Task Put_InvalidOrDuplicatePrefixes_Return400()
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await Put("owner", "BAD PREFIX", "BILL/")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Put("owner", "SAME/", "same/")).StatusCode);
    }

    [PostgresFact]
    public async Task Put_ByOwner_IsAuditedInDatabase()
    {
        var res = await Put("owner", "AUD/", "AUDB/");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        using var scope = _api.Services.CreateTestScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await db.AuditLogs.AnyAsync(a => a.Action == AuditActions.InvoiceSeriesPrefixChanged && a.NewValues!.Contains("AUD/")));
        Assert.Equal("AUD/", (await db.InvoiceNumberSeries.AsNoTracking().SingleAsync(s => s.SeriesKind == InvoiceSeriesKind.Gst)).Prefix);

        await Put("owner", "GST/", "BILL/"); // restore defaults for other tests
    }
}
