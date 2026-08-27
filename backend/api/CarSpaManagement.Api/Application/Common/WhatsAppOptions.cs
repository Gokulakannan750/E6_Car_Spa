namespace CarSpaManagement.Api.Application.Common;

public class WhatsAppOptions
{
    public const string SectionName = "WhatsApp";

    private static readonly string[] ObviousPlaceholders =
    [
        "CHANGE_ME",
        "CHANGE_ME_IN_PRODUCTION",
        "CHANGE_ME_IN_PRODUCTION_SUPPLIED_EXTERNALLY",
        "YOUR_WHATSAPP_KEY",
        "YOUR_ENCRYPTION_KEY",
        "REPLACE_WITH_SECRET",
        "REDACTED",
        "PLACEHOLDER",
        "DEFAULT_SECRET",
        "SECRET_KEY_HERE"
    ];

    public string EncryptionKey { get; set; } = string.Empty;

    public static void Validate(WhatsAppOptions options, bool isProduction)
    {
        if (options == null)
        {
            throw new InvalidOperationException("WhatsApp configuration section is missing.");
        }

        if (string.IsNullOrWhiteSpace(options.EncryptionKey))
        {
            if (isProduction)
            {
                throw new InvalidOperationException(
                    "WhatsApp Encryption Key is not configured. In production, supply 'WhatsApp:EncryptionKey' or environment variable 'WHATSAPP_ENCRYPTION_KEY'.");
            }
            return;
        }

        if (options.EncryptionKey.Length < 32)
        {
            throw new InvalidOperationException(
                $"WhatsApp Encryption Key must be at least 32 characters long for AES-256-GCM security. Current length is {options.EncryptionKey.Length}.");
        }

        if (isProduction)
        {
            var keyTrimmed = options.EncryptionKey.Trim();
            foreach (var placeholder in ObviousPlaceholders)
            {
                if (keyTrimmed.Contains(placeholder, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException(
                        "WhatsApp Encryption Key is set to a placeholder or default value. Supply a genuine, cryptographically random secret in production.");
                }
            }
        }
    }
}
