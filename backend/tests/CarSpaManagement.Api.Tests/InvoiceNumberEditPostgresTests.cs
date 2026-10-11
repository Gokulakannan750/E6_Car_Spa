using CarSpaManagement.Api.Infrastructure.Tenancy;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.DTOs.JobCards;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using JobCardServiceApp = CarSpaManagement.Api.Application.Services.JobCardService;

namespace CarSpaManagement.Api.Tests;

/// <summary>GST invoice number editing on REAL PostgreSQL: sequence interaction and unique-index backstop.</summary>
public class InvoiceNumberEditPostgresTests : IClassFixture<PostgresTestDatabase>
{
    private readonly PostgresTestDatabase _pg;
    public InvoiceNumberEditPostgresTests(PostgresTestDatabase pg) => _pg = pg;

    private static InvoiceService Invoices(AppDbContext db, Guid? userId)
    {
        var http = new DefaultHttpContext();
        if (userId is not null)
            http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString()), new Claim(JwtTokenService.OrganizationClaim, DefaultOrganization.Id.ToString())], "Test"));
        return new InvoiceService(db, new RecordingAuditLogService(), new ConfigurationBuilder().Build(),
            new HttpContextAccessor { HttpContext = http }, new NoopWhatsAppService(),
            new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>());
    }

    private async Task<Guid> EnsureOwnerAsync()
    {
        await using var db = _pg.CreateContext();
        var existing = await db.Users.FirstOrDefaultAsync(u => u.Role == UserRole.Owner);
        if (existing is not null) return existing.Id;
        var owner = new User { FullName = "Owner", Username = "owner", Role = UserRole.Owner, IsActive = true, PasswordHash = "x" };
        db.Users.Add(owner);
        await db.SaveChangesAsync();
        return owner.Id;
    }

    /// <summary>Creates a GST job card, generates its invoice through the real generator, and pays it in full.</summary>
    private async Task<(Guid id, string number)> CreatePaidGstInvoiceAsync()
    {
        Guid customerId, vehicleId, serviceId;
        await using (var db = _pg.CreateContext())
        {
            var suffix = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
            var customer = new Customer { Name = "Numbering Test", PhoneNumber = "9000000004" };
            var vehicle = new Vehicle { CustomerId = customer.Id, RegistrationNumber = $"TN04{suffix}", Make = "Test", Model = "Car" };
            var service = new Service { Name = $"Wash {suffix}", Category = "Exterior", Price = 1000m, TaxPercentage = 18m, IsActive = true };
            db.AddRange(customer, vehicle, service);
            await db.SaveChangesAsync();
            (customerId, vehicleId, serviceId) = (customer.Id, vehicle.Id, service.Id);
        }

        Guid invoiceId;
        await using (var db = _pg.CreateContext())
        {
            var jobCard = await new JobCardServiceApp(db, new RecordingAuditLogService()).CreateAsync(new CreateJobCardRequest
            {
                CustomerId = customerId, VehicleId = vehicleId,
                Services = [new JobCardServiceItemRequest { ServiceId = serviceId }],
            });
            var draft = await Invoices(db, null).CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
            invoiceId = draft.Id;
        }

        string number;
        await using (var db = _pg.CreateContext())
        {
            var invoice = await db.Invoices.AsNoTracking().SingleAsync(i => i.Id == invoiceId);
            var generated = await Invoices(db, null).GenerateInvoiceAsync(invoiceId, expectedTotalAmount: invoice.TotalAmount);
            number = generated.InvoiceNumber!;
        }
        await using (var db = _pg.CreateContext())
            await Invoices(db, null).RecordPaymentAsync(invoiceId, new RecordPaymentRequest(1180m, "Cash"));

        return (invoiceId, number);
    }

    private static (string prefix, long counter, int digits) Parse(string generatedNumber)
    {
        var m = System.Text.RegularExpressions.Regex.Match(generatedNumber, "^(.*?)([0-9]+)$");
        return (m.Groups[1].Value, long.Parse(m.Groups[2].Value), m.Groups[2].Value.Length);
    }

    [PostgresFact]
    public async Task Sequence_IsNotChanged_AndSkipsANumberTheOwnerAlreadyUsed()
    {
        var ownerId = await EnsureOwnerAsync();
        var (invoiceA, numberA) = await CreatePaidGstInvoiceAsync();
        var (prefix, n, digits) = Parse(numberA);

        // Owner takes the number the generator would hand out next.
        var claimed = $"{prefix}{(n + 1).ToString().PadLeft(digits, '0')}";
        await using (var db = _pg.CreateContext())
            Assert.Equal(claimed, (await Invoices(db, ownerId).UpdateInvoiceNumberAsync(invoiceA, new UpdateInvoiceNumberRequest(claimed))).InvoiceNumber);

        // The next generated invoice skips the claimed number instead of failing or duplicating it.
        var (_, numberB) = await CreatePaidGstInvoiceAsync();
        Assert.Equal($"{prefix}{(n + 2).ToString().PadLeft(digits, '0')}", numberB);

        // And a further one simply continues the sequence (it was neither reset nor moved by the edit).
        var (_, numberC) = await CreatePaidGstInvoiceAsync();
        Assert.Equal($"{prefix}{(n + 3).ToString().PadLeft(digits, '0')}", numberC);

        // The original number n is not re-issued.
        await using var read = _pg.CreateContext();
        Assert.Equal(0, await read.Invoices.CountAsync(i => i.InvoiceNumber == numberA));
    }

    [PostgresFact]
    public async Task ConcurrentRenamesToSameNumber_OnlyOneSucceeds_UniqueIndexBackstop()
    {
        var ownerId = await EnsureOwnerAsync();
        var (invoice1, _) = await CreatePaidGstInvoiceAsync();
        var (invoice2, _) = await CreatePaidGstInvoiceAsync();
        const string contested = "E6/RACE/0001";

        for (var round = 0; round < 3; round++)
        {
            var target = $"{contested}{round}";
            var contexts = new[] { _pg.CreateContext(), _pg.CreateContext() };
            foreach (var c in contexts) await c.Database.OpenConnectionAsync();
            var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var ids = new[] { invoice1, invoice2 };
            var tasks = Enumerable.Range(0, 2).Select(i => Task.Run(async () =>
            {
                await gate.Task;
                await Invoices(contexts[i], ownerId).UpdateInvoiceNumberAsync(ids[i], new UpdateInvoiceNumberRequest(target));
            })).ToList();
            gate.SetResult();

            var outcomes = new List<Exception?>();
            foreach (var t in tasks)
            {
                try { await t; outcomes.Add(null); }
                catch (Exception ex) { outcomes.Add(ex); }
            }
            foreach (var c in contexts) await c.DisposeAsync();

            Assert.Single(outcomes, o => o is null);
            Assert.Single(outcomes, o => o is ConflictException);
            await using var read = _pg.CreateContext();
            Assert.Equal(1, await read.Invoices.CountAsync(i => i.InvoiceNumber == target));
        }
    }

    [PostgresFact]
    public async Task PersistedNumber_RoundTripsWithSlashes_AndPaymentsStayLinked()
    {
        var ownerId = await EnsureOwnerAsync();
        var (invoiceId, _) = await CreatePaidGstInvoiceAsync();

        await using (var db = _pg.CreateContext())
            await Invoices(db, ownerId).UpdateInvoiceNumberAsync(invoiceId, new UpdateInvoiceNumberRequest("E6/INV/00125"));

        await using var read = _pg.CreateContext();
        var stored = await read.Invoices.AsNoTracking().Include(i => i.Payments).SingleAsync(i => i.Id == invoiceId);
        Assert.Equal("E6/INV/00125", stored.InvoiceNumber);
        Assert.Equal(InvoiceStatus.Paid, stored.Status);
        Assert.Equal(1180m, stored.Payments.Sum(p => p.Amount));
    }
}

/// <summary>GST invoice number editing over HTTP through the real API pipeline: Owner only.</summary>
public class InvoiceNumberEditHttpTests : IClassFixture<ApiTestHost>
{
    private readonly ApiTestHost _api;
    public InvoiceNumberEditHttpTests(ApiTestHost api) => _api = api;

    private async Task<Guid> SeedInvoiceAsync(string number, InvoiceStatus status = InvoiceStatus.Paid, bool gst = true)
    {
        using var scope = _api.Services.CreateTestScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var suffix = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var customer = new Customer { Name = "HTTP Numbering", PhoneNumber = "9000000005" };
        var vehicle = new Vehicle { CustomerId = customer.Id, RegistrationNumber = $"TN05{suffix}", Make = "Test", Model = "Car" };
        var jobCard = new JobCard { JobCardNumber = $"JC-N-{suffix}", CustomerId = customer.Id, VehicleId = vehicle.Id, Status = JobCardStatus.Invoiced };
        var invoice = new Invoice
        {
            InvoiceNumber = number, JobCardId = jobCard.Id, CustomerId = customer.Id, VehicleId = vehicle.Id,
            Subtotal = 1000m, TaxableAmount = 1000m, GstAmount = gst ? 180m : 0m, TotalAmount = gst ? 1180m : 1000m,
            PaidAmount = status == InvoiceStatus.Paid ? (gst ? 1180m : 1000m) : 0m, BalanceAmount = status == InvoiceStatus.Paid ? 0m : 1180m,
            IsGstEnabled = gst, Status = status,
        };
        db.AddRange(customer, vehicle, jobCard, invoice);
        await db.SaveChangesAsync();
        return invoice.Id;
    }

    private Task<HttpResponseMessage> Put(Guid id, string? asUser, string number) =>
        _api.SendAsync(HttpMethod.Put, $"/api/invoices/{id}/invoice-number", asUser, new { invoiceNumber = number });

    [PostgresFact]
    public async Task Owner_Gets200_AndNumberIsReturned()
    {
        var id = await SeedInvoiceAsync($"INV-H-{Guid.NewGuid():N}"[..14]);
        var res = await Put(id, "owner", "E6/HTTP/0001");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<Dictionary<string, object>>();
        Assert.Equal("E6/HTTP/0001", body!["invoiceNumber"].ToString());
    }

    [PostgresFact]
    public async Task Manager_Staff_Get403_AndAnonymousGets401()
    {
        var id = await SeedInvoiceAsync($"INV-H-{Guid.NewGuid():N}"[..14]);
        Assert.Equal(HttpStatusCode.Forbidden, (await Put(id, "manager.a", "E6/HTTP/0002")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Put(id, "staff.viewer", "E6/HTTP/0002")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Put(id, null, "E6/HTTP/0002")).StatusCode);
    }

    [PostgresFact]
    public async Task Owner_DuplicateGets409_BadFormat400_NonGst400_Unpaid400()
    {
        await SeedInvoiceAsync("E6/HTTP/DUP");
        var paidGst = await SeedInvoiceAsync($"INV-H-{Guid.NewGuid():N}"[..14]);
        var nonGst = await SeedInvoiceAsync($"INV-H-{Guid.NewGuid():N}"[..14], gst: false);
        var unpaid = await SeedInvoiceAsync($"INV-H-{Guid.NewGuid():N}"[..14], InvoiceStatus.Generated);

        Assert.Equal(HttpStatusCode.Conflict, (await Put(paidGst, "owner", "E6/HTTP/DUP")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Put(paidGst, "owner", "BAD NUMBER #1")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Put(nonGst, "owner", "E6/HTTP/0003")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Put(unpaid, "owner", "E6/HTTP/0004")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Put(Guid.NewGuid(), "owner", "E6/HTTP/0005")).StatusCode);
    }
}
