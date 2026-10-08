using Microsoft.Extensions.Configuration;

namespace CarSpaManagement.Api.Application.Common;

/// <summary>Where customer-facing invoice links point. Each deployment sets its own address.</summary>
public static class PublicLinks
{
    /// <summary>Used only when no address is configured, which is fine for local development.</summary>
    public const string DevelopmentFallback = "http://localhost:5173";

    /// <summary>The configured public invoice address without a trailing slash, or the development fallback when blank.</summary>
    public static string BaseUrl(IConfiguration configuration)
    {
        var configured = configuration["PublicInvoiceBaseUrl"];
        return (string.IsNullOrWhiteSpace(configured) ? DevelopmentFallback : configured.Trim()).TrimEnd('/');
    }
}
