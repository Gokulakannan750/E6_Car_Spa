using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Controllers.Platform;

public sealed record OwnerChoiceDto(string PlanCode, string Interval, PublicLicencesDto Licences, Dictionary<string, int> AddOns);

/// <summary>What the Owner's subscription page needs: what is on sale, what the company has, and licences in use.</summary>
public sealed record OwnerSubscriptionDto(
    PublicCatalogDto Catalog,
    OwnerChoiceDto Current,
    PublicLicencesDto LicencesInUse,
    string Status,
    DateTime CurrentPeriodEnd,
    bool CancelAtPeriodEnd,
    bool CanPayOnline,
    bool TestPayments);

public sealed record OwnerChangeResultDto(string Status, string Timing, DateTime EffectiveAt, long AmountNowMinor, Guid? InvoiceId, string? InvoiceNumber);

public sealed record OwnerInvoiceLineDto(string Description, int Quantity, long UnitPriceMinor, long AmountMinor);

public sealed record OwnerInvoiceDto(Guid Id, string InvoiceNumber, string Kind, string Status, DateTime IssuedAt, DateTime DueAt,
    DateTime? PeriodStart, DateTime? PeriodEnd, long SubtotalMinor, long TaxMinor, long TotalMinor, long AmountDueMinor, string Currency,
    DateTime? PaidAt, IReadOnlyList<OwnerInvoiceLineDto> Lines);

public sealed record OwnerCancelRequest(string? Reason);

/// <summary>
/// The company's Owner manages the Trovo subscription in the app (decided 13 Oct 2026): change plan, user licences
/// and add-ons, see and pay invoices, renew early, cancel at the period end. Only the Owner, since it is what the
/// company pays. Works while the company is read-only for non-payment, so it can pay. Until the payment gateway
/// (Phase 2.5) "Pay" is the test payment on test servers; elsewhere the Owner is asked to contact Trovo.
/// </summary>
[ApiController]
[Route("api/subscription/self")]
[Authorize]
public class OwnerSubscriptionController(
    PlatformDbContext catalog,
    AppDbContext db,
    ITenantContext tenant,
    CatalogReader catalogReader,
    SubscriptionService subscriptions,
    PlanChangeService planChanges,
    SignupService signups) : ControllerBase
{
    private const string OnlinePaymentSoon = "Online payment is coming soon. To pay now, call Trovo on +91 90426 72148.";

    [HttpGet]
    public async Task<ActionResult<OwnerSubscriptionDto>> Get(CancellationToken cancellationToken)
    {
        if (!IsOwner) return Forbid();
        var subscription = await subscriptions.CurrentAsync(Company, cancellationToken);
        var current = new OwnerChoiceDto(subscription.PlanVersion!.Plan!.Code, subscription.PlanVersion.Interval.ToString(),
            new PublicLicencesDto(subscription.AndroidLicences, subscription.WindowsLicences, subscription.BothLicences),
            subscription.Items.Where(i => i.EffectiveTo is null).ToDictionary(i => i.AddOnPrice!.AddOn!.Code, i => i.Quantity));
        var used = await InUseAsync(cancellationToken);
        return Ok(new OwnerSubscriptionDto(await catalogReader.ReadAsync(cancellationToken), current,
            new PublicLicencesDto(used.Android, used.Windows, used.Both), subscription.Status.ToString(), subscription.CurrentPeriodEnd,
            subscription.CancelAtPeriodEnd, signups.TestPaymentsAllowed, signups.TestPaymentsAllowed));
    }

    [HttpPost("preview")]
    [ProducesResponseType<PlanChangePreviewDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Preview([FromBody] OwnerChoiceDto choice, CancellationToken cancellationToken)
    {
        if (!IsOwner) return Forbid();
        return await Guarded(async () =>
        {
            var preview = await planChanges.PreviewAsync(Company, ToTarget(choice), cancellationToken);
            return Ok(new PlanChangePreviewDto(preview.Timing.ToString(), preview.CurrentPeriodPriceMinor, preview.NewPeriodPriceMinor,
                preview.AmountNowMinor, preview.Currency, preview.EffectiveAt));
        });
    }

    /// <summary>
    /// Makes the change: an upgrade starts now with an invoice for the rest of the paid period; a downgrade waits for
    /// the period end. Licences cannot go below the active users who have that access.
    /// </summary>
    [HttpPost("change")]
    [ProducesResponseType<OwnerChangeResultDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Change([FromBody] OwnerChoiceDto choice, CancellationToken cancellationToken)
    {
        if (!IsOwner) return Forbid();
        return await Guarded(async () =>
        {
            var target = ToTarget(choice);
            var used = await InUseAsync(cancellationToken);
            foreach (var (access, label) in new[] { (AppAccess.Both, "Windows + Android"), (AppAccess.Windows, "Windows only"), (AppAccess.Android, "Android only") })
            {
                if (target.Licences.Of(access) < used.Of(access))
                {
                    throw new ValidationException(
                        $"{used.Of(access)} active users have a {label} licence. Deactivate users or change their app access in Users first.");
                }
            }

            var request = await planChanges.ChangeByOwnerAsync(Company, target, UserId, User.FindFirstValue(ClaimTypes.Name), cancellationToken);
            var invoiceNumber = request.AdjustmentInvoiceId is { } invoiceId
                ? await catalog.BillingInvoices.Where(i => i.Id == invoiceId).Select(i => i.InvoiceNumber).FirstOrDefaultAsync(cancellationToken)
                : null;
            return Ok(new OwnerChangeResultDto(request.Status.ToString(), request.Timing.ToString(), request.EffectiveAt, request.AmountNowMinor,
                request.AdjustmentInvoiceId, invoiceNumber));
        });
    }

    [HttpGet("invoices")]
    public async Task<ActionResult<IReadOnlyList<OwnerInvoiceDto>>> Invoices(CancellationToken cancellationToken)
    {
        if (!IsOwner) return Forbid();
        var invoices = await catalog.BillingInvoices.AsNoTracking().Include(i => i.Lines)
            .Where(i => i.CompanyId == Company && i.Status != BillingInvoiceStatus.Draft)
            .OrderByDescending(i => i.IssuedAt).Take(50)
            .ToListAsync(cancellationToken);
        return Ok(invoices.Select(ToDto).ToList());
    }

    /// <summary>Test servers only: pays an open invoice as if paid online. Elsewhere: until the gateway, contact Trovo.</summary>
    [HttpPost("invoices/{id:guid}/pay")]
    [ProducesResponseType<OwnerInvoiceDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Pay(Guid id, CancellationToken cancellationToken)
    {
        if (!IsOwner) return Forbid();
        return await Guarded(async () =>
        {
            var invoice = await catalog.BillingInvoices.AsNoTracking().FirstOrDefaultAsync(i => i.Id == id && i.CompanyId == Company, cancellationToken)
                ?? throw new NotFoundException("Invoice not found.");
            if (!signups.TestPaymentsAllowed) throw new ConflictException(OnlinePaymentSoon);
            if (invoice.Status != BillingInvoiceStatus.Open) throw new ConflictException("This invoice is not open for payment.");

            await subscriptions.RecordPaymentAsync(invoice.Id, invoice.AmountDueMinor, SignupService.TestProvider, $"TEST-{Guid.NewGuid():N}",
                DateTime.UtcNow, new SubscriptionActor(PlatformActorType.Owner, UserId), cancellationToken);
            var paid = await catalog.BillingInvoices.AsNoTracking().Include(i => i.Lines).FirstAsync(i => i.Id == id, cancellationToken);
            return Ok(ToDto(paid));
        });
    }

    /// <summary>Issues the next period's invoice now (to renew early); an open one is returned instead of a new one.</summary>
    [HttpPost("renew")]
    [ProducesResponseType<OwnerInvoiceDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Renew(CancellationToken cancellationToken)
    {
        if (!IsOwner) return Forbid();
        return await Guarded(async () =>
        {
            var subscription = await subscriptions.CurrentAsync(Company, cancellationToken);
            if (subscription.CancelAtPeriodEnd) throw new ConflictException("Take back the cancellation first.");
            var open = await catalog.BillingInvoices.AsNoTracking().Include(i => i.Lines)
                .FirstOrDefaultAsync(i => i.SubscriptionId == subscription.Id && i.Status == BillingInvoiceStatus.Open && i.Kind == BillingInvoiceKind.Period,
                    cancellationToken);
            if (open is not null) return Ok(ToDto(open));
            var issued = await subscriptions.IssueNextInvoiceAsync(Company, cancellationToken);
            var withLines = await catalog.BillingInvoices.AsNoTracking().Include(i => i.Lines).FirstAsync(i => i.Id == issued.Id, cancellationToken);
            return Ok(ToDto(withLines));
        });
    }

    /// <summary>Cancels at the end of the paid period (nothing is refunded; data stays read-only for 90 days after).</summary>
    [HttpPost("cancel")]
    public async Task<IActionResult> Cancel([FromBody] OwnerCancelRequest request, CancellationToken cancellationToken)
    {
        if (!IsOwner) return Forbid();
        return await Guarded(async () =>
        {
            var subscription = await subscriptions.CurrentAsync(Company, cancellationToken);
            if (subscription.Status is not (SubscriptionStatus.Active or SubscriptionStatus.PastDue))
            {
                throw new ConflictException("Only a paid subscription can be cancelled here. Please contact Trovo.");
            }
            var reason = string.IsNullOrWhiteSpace(request.Reason) ? "Cancelled by the Owner in the app" : $"Cancelled by the Owner in the app: {request.Reason.Trim()}";
            await subscriptions.CancelAsync(Company, atPeriodEnd: true, reason, new SubscriptionActor(PlatformActorType.Owner, UserId), cancellationToken);
            return NoContent();
        });
    }

    [HttpPost("resume")]
    public async Task<IActionResult> Resume(CancellationToken cancellationToken)
    {
        if (!IsOwner) return Forbid();
        return await Guarded(async () =>
        {
            await subscriptions.ResumeAsync(Company, new SubscriptionActor(PlatformActorType.Owner, UserId), cancellationToken);
            return NoContent();
        });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private bool IsOwner => User.FindFirst("isOwner")?.Value == "true";

    private Guid Company => tenant.OrganizationId is { } id && id != Guid.Empty ? id : throw new ForbiddenException("No company is signed in.");

    private Guid? UserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    private async Task<LicenceCounts> InUseAsync(CancellationToken cancellationToken)
    {
        var used = await db.Users.Where(u => u.IsActive).GroupBy(u => u.AppAccess)
            .Select(g => new { Access = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Access, g => g.Count, cancellationToken);
        return new LicenceCounts(used.GetValueOrDefault(AppAccess.Android), used.GetValueOrDefault(AppAccess.Windows), used.GetValueOrDefault(AppAccess.Both));
    }

    private static PlanChangeTarget ToTarget(OwnerChoiceDto choice)
    {
        if (string.IsNullOrWhiteSpace(choice.PlanCode)) throw new ValidationException("Choose a plan.");
        if (!Enum.TryParse<BillingInterval>(choice.Interval, ignoreCase: true, out var interval) || !Enum.IsDefined(interval))
        {
            throw new ValidationException("Choose monthly or yearly billing.");
        }
        var licences = choice.Licences ?? throw new ValidationException("Choose the user licences.");
        return new PlanChangeTarget(choice.PlanCode.Trim().ToLowerInvariant(), interval, new LicenceCounts(licences.Android, licences.Windows, licences.Both),
            choice.AddOns ?? new Dictionary<string, int>());
    }

    private static OwnerInvoiceDto ToDto(BillingInvoice i) => new(i.Id, i.InvoiceNumber, i.Kind.ToString(), i.Status.ToString(), i.IssuedAt, i.DueAt,
        i.PeriodStart, i.PeriodEnd, i.SubtotalMinor, i.TaxMinor, i.TotalMinor, i.AmountDueMinor, i.Currency, i.PaidAt,
        i.Lines.OrderBy(l => l.SortOrder).Select(l => new OwnerInvoiceLineDto(l.Description, l.Quantity, l.UnitPriceMinor, l.AmountMinor)).ToList());

    private static async Task<IActionResult> Guarded(Func<Task<IActionResult>> action)
    {
        try { return await action(); }
        catch (ValidationException ex) { return new BadRequestObjectResult(new { error = ex.Message }); }
        catch (NotFoundException ex) { return new NotFoundObjectResult(new { error = ex.Message }); }
        catch (ConflictException ex) { return new ConflictObjectResult(new { error = ex.Message }); }
    }
}
