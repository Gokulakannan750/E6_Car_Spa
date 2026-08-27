using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.Common;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    private static readonly string[] ObviousPlaceholders =
    [
        "CHANGE_ME",
        "CHANGE_ME_IN_PRODUCTION",
        "CHANGE_ME_IN_PRODUCTION_SUPPLIED_EXTERNALLY",
        "YOUR_JWT_KEY",
        "REPLACE_WITH_SECRET",
        "REDACTED",
        "PLACEHOLDER",
        "DEFAULT_SECRET",
        "SECRET_KEY_HERE",
        "YOUR_SECRET_KEY"
    ];

    [Required(ErrorMessage = "JWT Key is required.")]
    public string Key { get; set; } = string.Empty;

    [Required(ErrorMessage = "JWT Issuer is required.")]
    public string Issuer { get; set; } = "E6CarSpa";

    [Required(ErrorMessage = "JWT Audience is required.")]
    public string Audience { get; set; } = "E6CarSpaDesktop";

    [Range(1, 43200, ErrorMessage = "ExpirationMinutes must be between 1 minute and 30 days.")]
    public int ExpirationMinutes { get; set; } = 1440;

    public static void Validate(JwtOptions options, bool isProduction)
    {
        if (options == null)
        {
            throw new InvalidOperationException("JWT configuration section is missing.");
        }

        if (string.IsNullOrWhiteSpace(options.Key))
        {
            throw new InvalidOperationException(
                "JWT Signing Key is not configured. In production, supply 'Jwt:Key' or environment variable 'JWT_KEY'. In development, use .NET User Secrets or environment variables.");
        }

        if (options.Key.Length < 32)
        {
            throw new InvalidOperationException(
                $"JWT Signing Key must be at least 32 characters (256 bits) for HMAC-SHA256 security. Current length is {options.Key.Length}.");
        }

        if (isProduction)
        {
            var keyTrimmed = options.Key.Trim();
            foreach (var placeholder in ObviousPlaceholders)
            {
                if (keyTrimmed.Contains(placeholder, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException(
                        "JWT Signing Key is set to a placeholder or default value. Supply a genuine, cryptographically random secret in production.");
                }
            }
        }

        if (string.IsNullOrWhiteSpace(options.Issuer))
        {
            throw new InvalidOperationException("JWT Issuer is required.");
        }

        if (string.IsNullOrWhiteSpace(options.Audience))
        {
            throw new InvalidOperationException("JWT Audience is required.");
        }

        if (options.ExpirationMinutes <= 0)
        {
            throw new InvalidOperationException("JWT ExpirationMinutes must be greater than zero.");
        }
    }
}
