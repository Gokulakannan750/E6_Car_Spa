using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Infrastructure.Platform.Products;
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
public sealed record PlatformInvoiceListItem(Guid Id, string InvoiceNumber, Guid CompanyId, string CompanyCode, string CompanyName,
    string Status, bool Overdue, string Currency, long TotalMinor, long AmountDueMinor, DateTime IssuedAt, DateTime DueAt,
    DateTime? PaidAt, DateTime? PeriodStart, DateTime? PeriodEnd, string? ProductKey = null);
public sealed record PlatformSellerDto(string Name, string Address, string Phone, string Email, string? Gstin);
public sealed record PlatformInvoiceDetail(PlatformInvoiceDto Invoice, string CompanyCode, string CompanyName, string? BillToAddress,
    string? BillToGstin, PlatformSellerDto Seller);
public sealed record VoidInvoiceRequest(string Reason);

/// <summary>Trovo's invoices to companies and the payments recorded against them (manual until a gateway is chosen).</summary>
[ApiController]
[Route("api/platform")]
[Authorize(Policy = PlatformPolicies.Any)]
public class PlatformBillingController(
    PlatformDbContext catalog,
    SubscriptionService subscriptions,
    PlatformAuditService audit,
    IOptions<PlatformOptions> options,
    ProductSelection products) : ControllerBase
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

    /// <summary>
    /// Trovo's invoices across all companies, for follow-up. Status: Open, Overdue (open and past due), Paid, Void,
    /// or empty for all. Search matches the invoice number, company code or name.
    /// </summary>
    [HttpGet("invoices")]
    public async Task<ActionResult<IReadOnlyList<PlatformInvoiceListItem>>> Invoices([FromQuery] string? status, [FromQuery] Guid? companyId,
        [FromQuery] string? search, CancellationToken cancellationToken, [FromQuery] string? product = null)
    {
        var now = DateTime.UtcNow;
        var productKey = products.OptionalKey(product);
        var query = from i in catalog.BillingInvoices.AsNoTracking()
                    join c in catalog.Companies.AsNoTracking().Include(c => c.Product) on i.CompanyId equals c.Id
                    where productKey == null || c.Product!.Key == productKey
                    select new { i, c };

        if (companyId is not null) query = query.Where(x => x.i.CompanyId == companyId);
        switch (status?.ToLowerInvariant())
        {
            case "open": query = query.Where(x => x.i.Status == BillingInvoiceStatus.Open); break;
            case "overdue": query = query.Where(x => x.i.Status == BillingInvoiceStatus.Open && x.i.DueAt < now); break;
            case "paid": query = query.Where(x => x.i.Status == BillingInvoiceStatus.Paid); break;
            case "void": query = query.Where(x => x.i.Status == BillingInvoiceStatus.Void); break;
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x => x.i.InvoiceNumber.ToLower().Contains(term) || x.c.Code.ToLower().Contains(term) || x.c.Name.ToLower().Contains(term));
        }

        var rows = await query.OrderByDescending(x => x.i.IssuedAt).Take(500).ToListAsync(cancellationToken);
        return Ok(rows.Select(x => new PlatformInvoiceListItem(
            x.i.Id, x.i.InvoiceNumber, x.c.Id, x.c.Code, x.c.Name, x.i.Status.ToString(),
            x.i.Status == BillingInvoiceStatus.Open && x.i.DueAt < now, x.i.Currency, x.i.TotalMinor, x.i.AmountDueMinor,
            x.i.IssuedAt, x.i.DueAt, x.i.PaidAt, x.i.PeriodStart, x.i.PeriodEnd, x.c.Product!.Key)).ToList());
    }

    /// <summary>One invoice with its lines, payments, the bill-to snapshot and Trovo's details, for the print view.</summary>
    [HttpGet("invoices/{invoiceId:guid}")]
    public async Task<ActionResult<PlatformInvoiceDetail>> Invoice(Guid invoiceId, CancellationToken cancellationToken)
    {
        var invoice = await catalog.BillingInvoices.AsNoTracking().Include(i => i.Lines).FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);
        if (invoice is null) return NotFound();
        var company = await catalog.Companies.AsNoTracking().FirstAsync(c => c.Id == invoice.CompanyId, cancellationToken);
        var payments = await catalog.PaymentTransactions.AsNoTracking().Where(p => p.BillingInvoiceId == invoiceId).ToListAsync(cancellationToken);
        var settings = options.Value;

        return Ok(new PlatformInvoiceDetail(ToDto(invoice, payments), company.Code, company.Name, invoice.BillToAddress, invoice.BillToGstin,
            new PlatformSellerDto(settings.SellerName, settings.SellerAddress, settings.SellerPhone, settings.SellerEmail,
                invoice.TaxMinor > 0 ? settings.Gstin : null)));
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
