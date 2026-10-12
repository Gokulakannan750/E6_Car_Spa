using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>
/// Applies the company's subscription to every company request: a read-only company can view and export but not
/// change anything; a company without access (suspended, never paid, past retention) is refused. Sign-in, the
/// subscription status, public pages, the platform API and payment callbacks are not affected.
/// </summary>
public sealed class SubscriptionAccessMiddleware(RequestDelegate next)
{
    private static readonly string[] Exempt =
    [
        "/api/auth", "/api/subscription", "/api/public", "/api/platform", "/api/billing", "/api/health"
    ];

    public async Task InvokeAsync(HttpContext context, ITenantContext tenant, IEntitlementService entitlements)
    {
        var path = context.Request.Path;
        if (tenant.OrganizationId is null || !path.StartsWithSegments("/api") || Exempt.Any(e => path.StartsWithSegments(e)))
        {
            await next(context);
            return;
        }

        var current = await entitlements.GetCurrentAsync(context.RequestAborted);
        if (current.Access == CompanyAccessLevel.None)
        {
            await RefuseAsync(context, "SUBSCRIPTION_INACTIVE", "This company's access is switched off. Please contact Trovo.");
            return;
        }

        if (current.Access == CompanyAccessLevel.ReadOnly && !HttpMethods.IsGet(context.Request.Method)
            && !HttpMethods.IsHead(context.Request.Method) && !HttpMethods.IsOptions(context.Request.Method))
        {
            await RefuseAsync(context, "SUBSCRIPTION_READ_ONLY",
                "Your subscription is read-only until payment is received. You can still view and export your data.");
            return;
        }

        await next(context);
    }

    private static Task RefuseAsync(HttpContext context, string code, string message)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return context.Response.WriteAsJsonAsync(new { error = message, code });
    }
}

/// <summary>
/// The endpoint needs a feature of the company's plan or add-ons (see <c>FeatureKeys</c>). Without it the request is
/// refused with code FEATURE_NOT_IN_PLAN. On a single-company server every feature is available.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequiresFeatureAttribute(string featureKey) : Attribute, IAsyncActionFilter
{
    public string FeatureKey { get; } = featureKey;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var entitlements = context.HttpContext.RequestServices.GetService<IEntitlementService>();
        if (entitlements is not null && !(await entitlements.GetCurrentAsync(context.HttpContext.RequestAborted)).Has(FeatureKey))
        {
            context.Result = new ObjectResult(new
            {
                error = "This feature is not included in your plan. Ask Trovo to add it.",
                code = "FEATURE_NOT_IN_PLAN",
                feature = FeatureKey
            })
            { StatusCode = StatusCodes.Status403Forbidden };
            return;
        }

        await next();
    }
}

/// <summary>Applies the subscription time rules (trial and grace endings, renewals, invoices) every 15 minutes.</summary>
public sealed class SubscriptionLifecycleWorker(IServiceScopeFactory scopes, ILogger<SubscriptionLifecycleWorker> logger) : BackgroundService
{
    private static readonly TimeSpan Every = TimeSpan.FromMinutes(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Let start-up (catalog migration) finish first.
        try { await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); } catch (OperationCanceledException) { return; }

        using var timer = new PeriodicTimer(Every);
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var changed = await scope.ServiceProvider.GetRequiredService<SubscriptionService>().RunLifecycleAsync(DateTime.UtcNow, stoppingToken);
                if (changed > 0) logger.LogInformation("Subscription lifecycle: {Count} subscription(s) changed state", changed);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Subscription lifecycle run failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
