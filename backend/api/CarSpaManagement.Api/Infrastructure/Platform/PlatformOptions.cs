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
}
