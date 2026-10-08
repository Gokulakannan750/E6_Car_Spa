using Npgsql;

namespace CarSpaManagement.Api.Application.Common;

/// <summary>
/// Startup checks that stop Development/placeholder configuration from being run as Production.
/// Errors abort startup; warnings are logged loudly but do not block an existing deployment.
/// </summary>
public static class StartupConfigurationGuard
{
    private static readonly string[] PlaceholderMarkers = ["CHANGE_ME", "YOUR_PASSWORD", "REPLACE_ME", "PLACEHOLDER"];
    private static readonly string[] SuperuserNames = ["postgres"];

    /// <exception cref="InvalidOperationException">Production is configured with a missing or placeholder connection string.</exception>
    public static void ValidateConnectionString(string? connectionString, bool isProduction)
    {
        if (!isProduction) return;

        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException(
                "Connection string 'DefaultConnection' is not configured. In production supply it via the environment variable 'ConnectionStrings__DefaultConnection'.");

        var builder = TryParse(connectionString);
        var password = builder?.Password ?? string.Empty;
        if (password.Length == 0 || PlaceholderMarkers.Any(m => password.Contains(m, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException(
                "The production database password is missing or still a placeholder. Supply the real connection string via 'ConnectionStrings__DefaultConnection'.");
    }

    /// <exception cref="InvalidOperationException">Production has no public invoice address, so customer links would be unusable.</exception>
    public static void ValidatePublicInvoiceBaseUrl(string? publicInvoiceBaseUrl, bool isProduction)
    {
        if (!isProduction) return;

        if (string.IsNullOrWhiteSpace(publicInvoiceBaseUrl))
            throw new InvalidOperationException(
                "'PublicInvoiceBaseUrl' is not configured. Set it to the https address that serves your customer invoice links (for example https://invoices.yourcompany.com) via configuration or the environment variable 'PublicInvoiceBaseUrl'.");
    }

    public static IReadOnlyList<string> GetWarnings(
        string? connectionString,
        bool isProduction,
        bool isDevelopment,
        string? listenUrls,
        string? publicInvoiceBaseUrl)
    {
        var warnings = new List<string>();

        if (isProduction)
        {
            var username = TryParse(connectionString ?? string.Empty)?.Username;
            if (username is not null && SuperuserNames.Contains(username, StringComparer.OrdinalIgnoreCase))
                warnings.Add($"Production connects to PostgreSQL as superuser '{username}'. Use a least-privilege application role (see scripts/db/create-app-role.sql).");

            if (!string.IsNullOrWhiteSpace(publicInvoiceBaseUrl) &&
                !publicInvoiceBaseUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                warnings.Add($"PublicInvoiceBaseUrl '{publicInvoiceBaseUrl}' is not HTTPS; customer invoice links will be sent over plain HTTP.");
        }

        if (isDevelopment && ListensOnNetwork(listenUrls))
            warnings.Add($"Running in Development mode while listening on a network interface ({listenUrls}). Development mode enables open CORS, detailed errors and sensitive SQL logging and must not be used to serve production users. Set ASPNETCORE_ENVIRONMENT=Production.");

        return warnings;
    }

    private static bool ListensOnNetwork(string? urls) =>
        !string.IsNullOrWhiteSpace(urls) &&
        urls.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(u => u.Contains("0.0.0.0") || u.Contains("://*") || u.Contains("://+") || u.Contains("[::]"));

    private static NpgsqlConnectionStringBuilder? TryParse(string connectionString)
    {
        try { return new NpgsqlConnectionStringBuilder(connectionString); }
        catch (ArgumentException) { return null; }
    }
}
