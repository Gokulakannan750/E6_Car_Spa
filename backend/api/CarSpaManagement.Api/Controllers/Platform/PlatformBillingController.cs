using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace CarSpaManagement.Api.Controllers.Platform;

public sealed record PlatformInvoiceLineDto(string Description, int Quantity, long UnitPriceMinor, long AmountMinor);
public sealed record PlatformPaymentDto(Guid Id, string Provider, long AmountMinor, string Currency, string Status, DateTime? PaidAt, string? Reference, long RefundedAmountMinor);
public sealed record PlatformInvoiceDto(
    Guid Id, string InvoiceNumber, string Title, string Status, string Currency, long SubtotalMinor, long TaxMinor, decimal? TaxRatePercent,
    long TotalMinor, long AmountDueMinor, DateTime IssuedAt, DateTime DueAt, DateTime? PaidAt, DateTime? PeriodStart, DateTime? PeriodEnd,
    string BillToName, IReadOnlyList<PlatformInvoiceLineDto> Lines, IReadOnlyList<PlatformPaymentDto> Payments);
public sealed record PlatformSubscriptionEventDto(string EventType, DateTime EffectiveAt, string ActorType, string? Metadata);
public sealed record PlatformCompanyBillingDto(IReadOnlyList<PlatformInvoiceDto> Invoices, IReadOnlyList<PlatformSubscriptionEventDto> Events);
public sealed record ManualPaymentRequest(long AmountMinor, string Reference, DateTime? PaidAt);
public sealed record VoidInvoiceRequest(string Reason);

/// <summary>Trovo's invoices to companies and the payments recorded against them (manual until a gateway is chosen).</summary>
[ApiController]
[Route("api/platform")]
[Authorize(Policy = PlatformPolicies.Any)]
public class PlatformBillingController(
    PlatformDbContext catalog,
    SubscriptionService subscriptions,
    PlatformAuditService audit,
    IOptions<PlatformOptions> options) : ControllerBase
{
    [HttpGet("companies/{id:guid}/billing")]
    public async Task<ActionResult<PlatformCompanyBillingDto>> CompanyBilling(Guid id, CancellationToken cancellationToken)
    {
        if (!await catalog.Companies.AnyAsync(c => c.Id == id, cancellationToken)) return NotFound();

        var invoices = await catalog.BillingInvoices.AsNoTracking().Include(i => i.Lines)
            .Where(i => i.CompanyId == id).OrderByDescending(i => i.IssuedAt).ToListAsync(cancellationToken);
        var invoiceIds = invoices.Select(i => i.Id).ToList();
        var payments = await catalog.PaymentTransactions.AsNoTracking()
            .Where(p => invoiceIds.Contains(p.BillingInvoiceId)).ToListAsync(cancellationToken);
        var subscriptionIds = await catalog.Subscriptions.Where(s => s.CompanyId == id).Select(s => s.Id).ToListAsync(cancellationToken);
        var events = await catalog.SubscriptionEvents.AsNoTracking()
            .Where(e => subscriptionIds.Contains(e.SubscriptionId)).OrderByDescending(e => e.EffectiveAt).Take(100)
            .ToListAsync(cancellationToken);

        return Ok(new PlatformCompanyBillingDto(
            invoices.Select(i => ToDto(i, payments.Where(p => p.BillingInvoiceId == i.Id))).ToList(),
            events.Select(e => new PlatformSubscriptionEventDto(e.EventType, e.EffectiveAt, e.ActorType.ToString(), e.Metadata)).ToList()));
    }

    /// <summary>Issues the invoice for the company's next period now.</summary>
    [HttpPost("companies/{id:guid}/invoices")]
    [Authorize(Policy = PlatformPolicies.Billing)]
    public async Task<ActionResult<PlatformInvoiceDto>> IssueInvoice(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var invoice = await subscriptions.IssueNextInvoiceAsync(id, cancellationToken);
            await audit.RecordAsync("invoice.issued", id, null, new { invoice.InvoiceNumber, invoice.TotalMinor }, null, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, ToDto(invoice, []));
        }
        catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (ConflictException ex) { return Conflict(new { error = ex.Message }); }
        catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>Records a payment received outside a gateway (bank transfer, UPI). Activates or renews when fully paid.</summary>
    [HttpPost("invoices/{invoiceId:guid}/payments")]
    [Authorize(Policy = PlatformPolicies.Billing)]
    public async Task<ActionResult<PlatformPaymentDto>> RecordPayment(Guid invoiceId, [FromBody] ManualPaymentRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var adminId = Guid.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var a) ? a : (Guid?)null;
            var payment = await subscriptions.RecordManualPaymentAsync(invoiceId, request.AmountMinor, request.Reference,
                request.PaidAt is { } paid ? DateTime.SpecifyKind(paid, DateTimeKind.Utc) : null,
                new SubscriptionActor(PlatformActorType.Admin, adminId), cancellationToken);
            var invoice = await catalog.BillingInvoices.AsNoTracking().FirstAsync(i => i.Id == invoiceId, cancellationToken);
            await audit.RecordAsync("payment.recorded", invoice.CompanyId, null,
                new { invoice.InvoiceNumber, payment.AmountMinor, payment.Reference, invoiceStatus = invoice.Status.ToString() }, null, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, ToDto(payment));
        }
        catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (ConflictException ex) { return Conflict(new { error = ex.Message }); }
        catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    /// <summary>Voids an open invoice that will not be paid (issued in error). Paid invoices cannot be voided.</summary>
    [HttpPost("invoices/{invoiceId:guid}/void")]
    [Authorize(Policy = PlatformPolicies.Billing)]
    public async Task<IActionResult> VoidInvoice(Guid invoiceId, [FromBody] VoidInvoiceRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { error = "A reason is required." });
        var invoice = await catalog.BillingInvoices.FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);
        if (invoice is null) return NotFound();
        if (invoice.Status != BillingInvoiceStatus.Open || invoice.AmountDueMinor != invoice.TotalMinor)
        {
            return Conflict(new { error = "Only an open invoice with no payments can be voided." });
        }

        invoice.Status = BillingInvoiceStatus.Void;
        invoice.AmountDueMinor = 0;
        await catalog.SaveChangesAsync(cancellationToken);
        await audit.RecordAsync("invoice.voided", invoice.CompanyId, new { invoice.InvoiceNumber, status = "Open" }, new { status = "Void" }, request.Reason, cancellationToken);
        return NoContent();
    }

    private PlatformInvoiceDto ToDto(BillingInvoice i, IEnumerable<PaymentTransaction> payments) => new(
        i.Id, i.InvoiceNumber, i.TaxMinor > 0 ? "Tax Invoice" : "Invoice", i.Status.ToString(), i.Currency, i.SubtotalMinor, i.TaxMinor,
        i.TaxRatePercent, i.TotalMinor, i.AmountDueMinor, i.IssuedAt, i.DueAt, i.PaidAt, i.PeriodStart, i.PeriodEnd, i.BillToName,
        i.Lines.OrderBy(l => l.SortOrder).Select(l => new PlatformInvoiceLineDto(l.Description, l.Quantity, l.UnitPriceMinor, l.AmountMinor)).ToList(),
        payments.Select(ToDto).ToList());

    private static PlatformPaymentDto ToDto(PaymentTransaction p) =>
        new(p.Id, p.Provider, p.AmountMinor, p.Currency, p.Status.ToString(), p.PaidAt, p.Reference, p.RefundedAmountMinor);
}
