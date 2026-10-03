using System.Text.RegularExpressions;

namespace CarSpaManagement.Api.Application.Common;

/// <summary>
/// Format rule for invoice numbers chosen manually by the Owner.
///
/// PROVISIONAL: pending confirmation from E6. Mirrors the GST tax-invoice serial number convention
/// (at most 16 characters; letters, digits, hyphen '-' and slash '/'). Change it here only.
/// </summary>
public static partial class InvoiceNumberRules
{
    public const int MaxLength = 16;

    public const string FormatDescription =
        "Invoice number must be 1 to 16 characters and may contain only letters, digits, '-' and '/'.";

    [GeneratedRegex("^[A-Za-z0-9/-]{1,16}$")]
    private static partial Regex AllowedFormat();

    /// <summary>Returns the trimmed number, or throws <see cref="ArgumentException"/> when it is not allowed.</summary>
    public static string Normalize(string? invoiceNumber)
    {
        var trimmed = invoiceNumber?.Trim() ?? string.Empty;
        if (trimmed.Length == 0 || !AllowedFormat().IsMatch(trimmed))
            throw new ArgumentException(FormatDescription, nameof(invoiceNumber));
        return trimmed;
    }
}
