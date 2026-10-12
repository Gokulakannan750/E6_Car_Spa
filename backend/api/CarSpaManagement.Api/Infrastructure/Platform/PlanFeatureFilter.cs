using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>
/// Which plan feature a permission belongs to. The same mapping is used by the Windows and Android apps to hide
/// modules, so the server and the apps always agree. Permissions not listed here are in every plan.
/// </summary>
public static class PlanFeatureMap
{
    public static string? ForPermission(string permission)
    {
        if (permission.StartsWith("showroom.", StringComparison.Ordinal) || permission == "reports.showrooms")
            return FeatureKeys.Showroom;
        if (permission.StartsWith("staff_advances.", StringComparison.Ordinal) || permission.StartsWith("staff_salary.", StringComparison.Ordinal)
            || permission == "reports.staff_advances")
            return FeatureKeys.StaffAdvances;
        if (permission.StartsWith("outsidejobs.", StringComparison.Ordinal) || permission.StartsWith("vendors.", StringComparison.Ordinal))
            return FeatureKeys.OutsideJobs;
        if (permission.StartsWith("audit.", StringComparison.Ordinal))
            return FeatureKeys.AuditTrail;
        if (permission is "reports.gst" or "reports.job_cards" or "reports.staff_productivity")
            return FeatureKeys.AdvancedReports;
        return null;
    }
}

/// <summary>
/// Refuses a request whose required permission belongs to a module outside the company's plan (code
/// FEATURE_NOT_IN_PLAN). Decided per endpoint from its own [RequirePermission], so an endpoint that merely lives
/// next to a plan module (e.g. the staff list in the staff-advances controller) stays available.
/// </summary>
public sealed class PlanFeatureFilter(IEntitlementService entitlements) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var features = context.ActionDescriptor.EndpointMetadata
            .OfType<RequirePermissionAttribute>()
            .Select(a => a.Policy?.StartsWith(RequirePermissionAttribute.PolicyPrefix, StringComparison.Ordinal) == true
                ? PlanFeatureMap.ForPermission(a.Policy[RequirePermissionAttribute.PolicyPrefix.Length..])
                : null)
            .Where(f => f is not null)
            .Distinct()
            .ToList();

        if (features.Count > 0)
        {
            var current = await entitlements.GetCurrentAsync(context.HttpContext.RequestAborted);
            var missing = features.FirstOrDefault(f => !current.Has(f!));
            if (missing is not null)
            {
                context.Result = new ObjectResult(new
                {
                    error = "This feature is not included in your plan. Ask Trovo to add it.",
                    code = "FEATURE_NOT_IN_PLAN",
                    feature = missing
                })
                { StatusCode = StatusCodes.Status403Forbidden };
                return;
            }
        }

        await next();
    }
}
