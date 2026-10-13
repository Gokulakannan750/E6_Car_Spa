using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Controllers;

/// <summary>What the signed-in company's subscription allows, for the apps' banner and module visibility.</summary>
public sealed record SubscriptionStatusDto(
    bool Managed,
    string Access,
    string? Status,
    string? PlanCode,
    string? PlanName,
    string? Interval,
    IReadOnlyDictionary<string, string> Features,
    int? SeatLimit,
    int SeatsUsed,
    DateTime? TrialEndsAt,
    DateTime? GraceEndsAt,
    DateTime? CurrentPeriodEnd,
    SubscriptionBannerDto? Banner,
    IReadOnlyList<LicenceUsageDto>? Licences = null);

/// <summary>User licences of one app type: how many the company bought and how many active users have that access.</summary>
public sealed record LicenceUsageDto(string AppAccess, int Total, int Used);

/// <summary>A message the apps show at the top of the screen: info, warning or error.</summary>
public sealed record SubscriptionBannerDto(string Level, string Message);

[ApiController]
[Route("api/subscription")]
[Authorize]
public class SubscriptionController(IEntitlementService entitlements, AppDbContext db) : ControllerBase
{
    [HttpGet("status")]
    public async Task<ActionResult<SubscriptionStatusDto>> GetStatus(CancellationToken cancellationToken)
    {
        var current = await entitlements.GetCurrentAsync(cancellationToken);
        var seatsUsed = await db.Users.CountAsync(u => u.IsActive, cancellationToken);
        List<LicenceUsageDto>? licences = null;
        if (current.Licences is { } bought)
        {
            var used = await db.Users.Where(u => u.IsActive).GroupBy(u => u.AppAccess)
                .Select(g => new { Access = g.Key, Count = g.Count() })
                .ToDictionaryAsync(g => g.Access, g => g.Count, cancellationToken);
            licences = new[] { AppAccess.Both, AppAccess.Windows, AppAccess.Android }
                .Select(a => new LicenceUsageDto(a.ToString(), bought.Of(a), used.GetValueOrDefault(a)))
                .ToList();
        }
        return Ok(new SubscriptionStatusDto(
            current.Managed,
            current.Access.ToString(),
            current.Status?.ToString(),
            current.PlanCode,
            current.PlanName,
            current.Interval?.ToString(),
            current.Features,
            current.SeatLimit,
            seatsUsed,
            current.TrialEndsAt,
            current.GraceEndsAt,
            current.CurrentPeriodEnd,
            BannerFor(current, DateTime.UtcNow),
            licences));
    }

    /// <summary>The banner for a subscription state (docs/SAAS_PHASE2_PLAN.md §5), or none.</summary>
    public static SubscriptionBannerDto? BannerFor(CompanyEntitlements current, DateTime now)
    {
        if (!current.Managed) return null;
        static string Date(DateTime? value) => value?.ToLocalTime().ToString("dd MMM yyyy") ?? "soon";

        return current.Status switch
        {
            SubscriptionStatus.Trialing when current.TrialEndsAt is { } end && end - now <= TimeSpan.FromDays(3) =>
                new("info", $"Your free trial ends on {Date(end)}. Contact Trovo to choose a plan."),
            SubscriptionStatus.PastDue =>
                new("warning", $"Payment is overdue. Please pay by {Date(current.GraceEndsAt)} to avoid read-only mode."),
            SubscriptionStatus.ReadOnly =>
                new("error", "Read-only: your subscription is unpaid. You can view and export data. Contact Trovo to pay."),
            SubscriptionStatus.Canceled =>
                new("error", "Your subscription has ended. Your data stays available read-only for a limited time."),
            _ => null
        };
    }
}
