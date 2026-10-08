using CarSpaManagement.Api.Infrastructure.Tenancy;
using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// GST invoice number editing: the Owner may replace the automatic number of a fully paid GST invoice
/// with a number of their choosing (provisional format: 1-16 chars, letters/digits/'-'/'/', unique).
/// </summary>
public class InvoiceNumberEditTests
{
    private sealed class Env
    {
        public required AppDbContext Db { get; init; }
        public required RecordingAuditLogService Audit { get; init; }
        public required User Owner { get; init; }
        public required User Manager { get; init; }
        public required User Staff { get; init; }
        public required Customer Customer { get; init; }
        public required Vehicle Vehicle { get; init; }

        public InvoiceService ServiceAs(User? user)
        {
            var http = new DefaultHttpContext();
            if (user is not null)
                http.User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), new Claim(JwtTokenService.OrganizationClaim, DefaultOrganization.Id.ToString()), new Claim(ClaimTypes.Role, user.Role.ToString())], "Test"));
            return new InvoiceService(Db, Audit, new ConfigurationBuilder().Build(),
                new HttpContextAccessor { HttpContext = http }, new NoopWhatsAppService(),
                new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>());
        }

        public async Task<Invoice> AddInvoiceAsync(string number, InvoiceStatus status = InvoiceStatus.Paid, bool gst = true)
        {
            var jobCard = new JobCard { JobCardNumber = $"JC-{Guid.NewGuid():N}"[..20], CustomerId = Customer.Id, VehicleId = Vehicle.Id, Status = JobCardStatus.Invoiced };
            var paid = status == InvoiceStatus.Paid ? 1180m : status == InvoiceStatus.PartiallyPaid ? 500m : 0m;
            var invoice = new Invoice
            {
                InvoiceNumber = status == InvoiceStatus.Draft ? null : number,
                JobCardId = jobCard.Id, CustomerId = Customer.Id, VehicleId = Vehicle.Id,
                Subtotal = 1000m, TaxableAmount = 1000m, GstAmount = gst ? 180m : 0m, TotalAmount = gst ? 1180m : 1000m,
                PaidAmount = paid, BalanceAmount = (gst ? 1180m : 1000m) - paid,
                IsGstEnabled = gst, Status = status,
            };
            if (paid > 0) invoice.Payments.Add(new Payment { Amount = paid, PaymentMethod = PaymentMethod.Cash, PaymentDate = DateTime.UtcNow });
            Db.AddRange(jobCard, invoice);
            await Db.SaveChangesAsync();
            Db.ChangeTracker.Clear();
            return invoice;
        }

        public async Task<string?> NumberOf(Guid id) =>
            (await Db.Invoices.AsNoTracking().SingleAsync(i => i.Id == id)).InvoiceNumber;
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
        var customer = new Customer { Name = "Customer", PhoneNumber = "9000000003" };
        var vehicle = new Vehicle { CustomerId = customer.Id, RegistrationNumber = "TN03AB0001", Make = "Make", Model = "Model" };
        db.AddRange(owner, manager, staff, customer, vehicle);
        await db.SaveChangesAsync();
        return new Env { Db = db, Audit = new RecordingAuditLogService(), Owner = owner, Manager = manager, Staff = staff, Customer = customer, Vehicle = vehicle };
    }

    private static UpdateInvoiceNumberRequest Rename(string number) => new(number);

    [Fact]
    public async Task Owner_CanSetOwnNumber_OnFullyPaidGstInvoice_AndItIsAudited()
    {
        var env = await CreateAsync();
        var invoice = await env.AddInvoiceAsync("INV-2026-000125");

        var dto = await env.ServiceAs(env.Owner).UpdateInvoiceNumberAsync(invoice.Id, Rename("E6/INV/00125"));

        Assert.Equal("E6/INV/00125", dto.InvoiceNumber);
        Assert.Equal("E6/INV/00125", await env.NumberOf(invoice.Id));
        Assert.Contains(env.Audit.Entries, e => e.Action == AuditActions.InvoiceNumberChanged && e.EntityId == invoice.Id && e.Outcome == "Success");
    }

    [Fact]
    public async Task ChangingNumber_DoesNotTouchAmountsPaymentsOrStatus()
    {
        var env = await CreateAsync();
        var invoice = await env.AddInvoiceAsync("INV-2026-000126");

        await env.ServiceAs(env.Owner).UpdateInvoiceNumberAsync(invoice.Id, Rename("E6-126"));

        var stored = await env.Db.Invoices.AsNoTracking().Include(i => i.Payments).SingleAsync(i => i.Id == invoice.Id);
        Assert.Equal(InvoiceStatus.Paid, stored.Status);
        Assert.Equal(1180m, stored.TotalAmount);
        Assert.Equal(1180m, stored.PaidAmount);
        Assert.Equal(0m, stored.BalanceAmount);
        Assert.Single(stored.Payments);
    }

    [Fact]
    public async Task Manager_Staff_AndAnonymous_AreForbidden()
    {
        var env = await CreateAsync();
        var invoice = await env.AddInvoiceAsync("INV-2026-000127");

        foreach (var caller in new[] { env.Manager, env.Staff, null })
        {
            await Assert.ThrowsAsync<ForbiddenException>(() =>
                env.ServiceAs(caller).UpdateInvoiceNumberAsync(invoice.Id, Rename("HIJACK-1")));
        }
        Assert.Equal("INV-2026-000127", await env.NumberOf(invoice.Id));
    }

    [Fact]
    public async Task InactiveOwnerAccount_IsForbidden()
    {
        var env = await CreateAsync();
        var invoice = await env.AddInvoiceAsync("INV-2026-000128");
        var owner = await env.Db.Users.SingleAsync(u => u.Id == env.Owner.Id);
        owner.IsActive = false;
        await env.Db.SaveChangesAsync();

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            env.ServiceAs(env.Owner).UpdateInvoiceNumberAsync(invoice.Id, Rename("E6-128")));
    }

    [Fact]
    public async Task NonGstInvoice_IsRejected()
    {
        var env = await CreateAsync();
        var invoice = await env.AddInvoiceAsync("INV-2026-000129", gst: false);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            env.ServiceAs(env.Owner).UpdateInvoiceNumberAsync(invoice.Id, Rename("E6-129")));
        Assert.Contains("Only GST invoices", ex.Message);
        Assert.Equal("INV-2026-000129", await env.NumberOf(invoice.Id));
    }

    [Theory]
    [InlineData(InvoiceStatus.Draft)]
    [InlineData(InvoiceStatus.Generated)]
    [InlineData(InvoiceStatus.PartiallyPaid)]
    [InlineData(InvoiceStatus.Cancelled)]
    public async Task InvoiceThatIsNotFullyPaid_IsRejected(InvoiceStatus status)
    {
        var env = await CreateAsync();
        var invoice = await env.AddInvoiceAsync("INV-2026-000130", status);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            env.ServiceAs(env.Owner).UpdateInvoiceNumberAsync(invoice.Id, Rename("E6-130")));
        Assert.Contains("fully paid", ex.Message);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("ABCDEFGHIJ1234567")] // 17 characters
    [InlineData("INV 0001")]
    [InlineData("INV#0001")]
    [InlineData("INV_0001")]
    [InlineData("INV.0001")]
    [InlineData("இன்வாய்ஸ்1")]
    public async Task InvalidFormat_IsRejected(string number)
    {
        var env = await CreateAsync();
        var invoice = await env.AddInvoiceAsync("INV-2026-000131");

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            env.ServiceAs(env.Owner).UpdateInvoiceNumberAsync(invoice.Id, Rename(number)));
        Assert.Contains("1 to 16 characters", ex.Message);
        Assert.Equal("INV-2026-000131", await env.NumberOf(invoice.Id));
    }

    [Theory]
    [InlineData("E6/INV/00125", "E6/INV/00125")]
    [InlineData("ABCDEFGHIJ123456", "ABCDEFGHIJ123456")] // exactly 16
    [InlineData("  e6-2026-77  ", "e6-2026-77")]        // trimmed
    [InlineData("1", "1")]
    public async Task ValidFormats_AreAccepted(string input, string expected)
    {
        var env = await CreateAsync();
        var invoice = await env.AddInvoiceAsync("INV-2026-000132");

        var dto = await env.ServiceAs(env.Owner).UpdateInvoiceNumberAsync(invoice.Id, Rename(input));
        Assert.Equal(expected, dto.InvoiceNumber);
    }

    [Fact]
    public async Task DuplicateNumber_IsRejected_IncludingDifferentCaseAndCancelledInvoices()
    {
        var env = await CreateAsync();
        var target = await env.AddInvoiceAsync("INV-2026-000133");
        await env.AddInvoiceAsync("E6/INV/00125");
        await env.AddInvoiceAsync("E6-CANCELLED-1", InvoiceStatus.Cancelled);

        await Assert.ThrowsAsync<ConflictException>(() => env.ServiceAs(env.Owner).UpdateInvoiceNumberAsync(target.Id, Rename("E6/INV/00125")));
        await Assert.ThrowsAsync<ConflictException>(() => env.ServiceAs(env.Owner).UpdateInvoiceNumberAsync(target.Id, Rename("e6/inv/00125")));
        await Assert.ThrowsAsync<ConflictException>(() => env.ServiceAs(env.Owner).UpdateInvoiceNumberAsync(target.Id, Rename("E6-CANCELLED-1")));
        Assert.Equal("INV-2026-000133", await env.NumberOf(target.Id));
    }

    [Fact]
    public async Task SameNumber_IsANoOp_WithoutAudit()
    {
        var env = await CreateAsync();
        var invoice = await env.AddInvoiceAsync("E6-SAME-1");

        var dto = await env.ServiceAs(env.Owner).UpdateInvoiceNumberAsync(invoice.Id, Rename(" E6-SAME-1 "));

        Assert.Equal("E6-SAME-1", dto.InvoiceNumber);
        Assert.DoesNotContain(env.Audit.Entries, e => e.Action == AuditActions.InvoiceNumberChanged);
    }

    [Fact]
    public async Task UnknownInvoice_ReturnsNotFound()
    {
        var env = await CreateAsync();
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            env.ServiceAs(env.Owner).UpdateInvoiceNumberAsync(Guid.NewGuid(), Rename("E6-404")));
    }

    [Theory]
    [InlineData(WhatsAppMessageStatus.Pending, false)]
    [InlineData(WhatsAppMessageStatus.Processing, false)]
    [InlineData(WhatsAppMessageStatus.Sent, true)]
    [InlineData(WhatsAppMessageStatus.Failed, true)]
    public async Task WhatsAppMessageInFlight_BlocksChange(WhatsAppMessageStatus messageStatus, bool allowed)
    {
        var env = await CreateAsync();
        var invoice = await env.AddInvoiceAsync("INV-2026-000134");
        env.Db.WhatsAppMessages.Add(new WhatsAppMessage
        {
            InvoiceId = invoice.Id, CustomerId = env.Customer.Id, MessageType = WhatsAppMessageType.PaymentCompleted,
            RecipientPhone = "919000000003", Status = messageStatus,
        });
        await env.Db.SaveChangesAsync();

        var call = () => env.ServiceAs(env.Owner).UpdateInvoiceNumberAsync(invoice.Id, Rename("E6-134"));
        if (allowed)
        {
            Assert.Equal("E6-134", (await call()).InvoiceNumber);
        }
        else
        {
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(call);
            Assert.Contains("WhatsApp", ex.Message);
        }
    }

    [Fact]
    public void ProvisionalFormatRule_IsCentralised()
    {
        Assert.Equal(16, InvoiceNumberRules.MaxLength);
        Assert.Equal("E6/INV/1", InvoiceNumberRules.Normalize(" E6/INV/1 "));
        Assert.Throws<ArgumentException>(() => InvoiceNumberRules.Normalize(null));
    }
}
