namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>
/// Settings for running as Trovo's multi-company platform ("Platform" section). When <see cref="Enabled"/> is false
/// the API works as before: one database from ConnectionStrings:DefaultConnection.
/// </summary>
/// <remarks>
/// When enabled, two more connection strings are used (both from server secrets, never from appsettings.json):
/// <list type="bullet">
/// <item><c>ConnectionStrings:Platform</c> — the catalog database.</item>
/// <item><c>ConnectionStrings:PlatformAdmin</c> — a privileged login (CREATEDB, CREATEROLE) used only to create company
/// databases and logins and to migrate them. Normal requests never use it.</item>
/// </list>
/// </remarks>
public class PlatformOptions
{
    public const string SectionName = "Platform";

    public bool Enabled { get; set; }

    /// <summary>The product this API serves; company codes are looked up within it.</summary>
    public string ProductKey { get; set; } = "carspa";

    /// <summary>The product's display name, used when the catalog is first created.</summary>
    public string ProductName { get; set; } = "Car Spa Management";

    /// <summary>How long a registration code stays valid.</summary>
    public int RegistrationCodeValidDays { get; set; } = 14;

    /// <summary>Wrong registration-code attempts allowed before the code is locked.</summary>
    public int RegistrationCodeMaxAttempts { get; set; } = 5;

    /// <summary>
    /// Public invoice links made before the platform carry no company code; they belong to this company (E6, whose
    /// links were already sent to customers).
    /// </summary>
    public string LegacyPublicLinkCompanyCode { get; set; } = "0001";

    /// <summary>How long company lookups are cached (seconds), so a suspension takes effect quickly.</summary>
    public int DirectoryCacheSeconds { get; set; } = 30;

    // ── Subscriptions ────────────────────────────────────────────────────────────

    /// <summary>Length of the free trial (full Professional).</summary>
    public int TrialDays { get; set; } = 7;

    /// <summary>Days of full access after a renewal fails or a paid period ends unpaid, before read-only.</summary>
    public int GraceDays { get; set; } = 7;

    /// <summary>Days a canceled company keeps read-only access to its data (then deleted on request).</summary>
    public int CanceledRetentionDays { get; set; } = 90;

    /// <summary>How many days before a period ends its renewal invoice is issued.</summary>
    public int RenewalInvoiceDaysBefore { get; set; } = 7;

    // ── Trovo's invoices ─────────────────────────────────────────────────────────

    /// <summary>Invoice number prefix: TROVO/2026-27/0001.</summary>
    public string InvoicePrefix { get; set; } = "TROVO";

    /// <summary>
    /// Trovo's GSTIN. Empty while Trovo is not registered: invoices then carry no GST and are titled "Invoice".
    /// Once set, new invoices charge <see cref="GstRatePercent"/>; issued invoices never change.
    /// </summary>
    public string? Gstin { get; set; }

    public decimal GstRatePercent { get; set; } = 18m;

    /// <summary>Whether Trovo charges GST on new invoices.</summary>
    public bool ChargesGst => !string.IsNullOrWhiteSpace(Gstin);

    // ── Trovo's details on its invoices, and the admin portal ────────────────────

    public string SellerName { get; set; } = "Trovo Tech Solutions";
    public string SellerAddress { get; set; } = "37, Gokul Illam, 2 Velampalayam, Erode, Tamil Nadu 638112, India";
    public string SellerPhone { get; set; } = "+91 90426 72148";
    public string SellerEmail { get; set; } = "info@trovotechsolutions.in";

    /// <summary>The admin portal's address (e.g. https://admin.trovotechsolutions.in), allowed to call the API (CORS).</summary>
    public string? AdminPortalOrigin { get; set; }
}

/// <summary>
/// Leaves Trovo's platform controllers out entirely when the platform is not enabled, so a single-company server has
/// no /api/platform endpoints at all.
/// </summary>
public sealed class PlatformControllerFeatureProvider(bool platformEnabled)
    : Microsoft.AspNetCore.Mvc.Controllers.ControllerFeatureProvider
{
    protected override bool IsController(System.Reflection.TypeInfo typeInfo) =>
        base.IsController(typeInfo) &&
        (platformEnabled || typeInfo.Namespace != "CarSpaManagement.Api.Controllers.Platform");
}
