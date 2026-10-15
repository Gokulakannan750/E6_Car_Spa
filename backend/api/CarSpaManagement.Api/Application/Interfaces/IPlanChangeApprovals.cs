namespace CarSpaManagement.Api.Application.Interfaces;

/// <summary>A plan, as the company's Owner sees it in a proposal.</summary>
public sealed record PlanTermsSummaryDto(string PlanName, string Interval, int AndroidLicences, int WindowsLicences, int BothLicences,
    IReadOnlyList<string> AddOns, IReadOnlyList<CarSpaManagement.Api.Infrastructure.Platform.SeatDto>? Seats = null);

/// <summary>
/// A change to the company's plan that Trovo proposed (Status "Pending", waiting for the Owner), or that the Owner
/// approved and starts when the paid period ends ("Scheduled"). Amounts are in minor units, before tax.
/// </summary>
public sealed record PlanChangeProposalDto(
    Guid Id,
    string Status,
    string Timing,
    PlanTermsSummaryDto From,
    PlanTermsSummaryDto To,
    long CurrentPeriodPriceMinor,
    long NewPeriodPriceMinor,
    long AmountNowMinor,
    string Currency,
    DateTime EffectiveAt,
    DateTime ExpiresAt,
    string? Reason);

/// <summary>The signed-in company's side of plan changes (Trovo's platform only; elsewhere there are none).</summary>
public interface IPlanChangeApprovals
{
    Task<PlanChangeProposalDto?> GetOpenAsync(CancellationToken cancellationToken = default);
    Task<PlanChangeProposalDto?> ApproveAsync(Guid id, CancellationToken cancellationToken = default);
    Task DeclineAsync(Guid id, CancellationToken cancellationToken = default);
}
