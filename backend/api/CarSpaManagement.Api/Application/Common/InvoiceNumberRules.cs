using System.Text.RegularExpressions;

namespace CarSpaManagement.Api.Application.Common;

/// <summary>
/// Single home for invoice-number formats.
///
/// PROVISIONAL (pending confirmation from E6's accountant): manually chosen numbers follow the GST tax-invoice
/// serial convention (at most 16 characters; letters, digits, '-' and '/'). Series prefixes use the same
/// character set, at most 10 characters. Change the rules here only.
/// </summary>
public static partial class InvoiceNumberRules
{
    public const int MaxLength = 16;
    public const int PrefixMaxLength = 10;

    /// <summary>Database column length for Invoices.InvoiceNumber / InvoiceNumberAllocations.InvoiceNumber.</summary>
    public const int StorageMaxLength = 30;

    public const string FormatDescription =
        "Invoice number must be 1 to 16 characters and may contain only letters, digits, '-' and '/'.";

    public const string PrefixFormatDescription =
        "Prefix must be 1 to 10 characters and may contain only letters, digits, '-' and '/'.";

    [GeneratedRegex("^[A-Za-z0-9/-]{1,16}$")]
    private static partial Regex AllowedFormat();

    [GeneratedRegex("^[A-Za-z0-9/-]{1,10}$")]
    private static partial Regex AllowedPrefix();

    /// <summary>Returns the trimmed number, or throws <see cref="ArgumentException"/> when it is not allowed.</summary>
    public static string Normalize(string? invoiceNumber)
    {
        var trimmed = invoiceNumber?.Trim() ?? string.Empty;
        if (trimmed.Length == 0 || !AllowedFormat().IsMatch(trimmed))
            throw new ArgumentException(FormatDescription, nameof(invoiceNumber));
        return trimmed;
    }

    /// <summary>Returns the trimmed, upper-cased prefix, or throws <see cref="ArgumentException"/>.</summary>
    public static string NormalizePrefix(string? prefix)
    {
        var trimmed = prefix?.Trim() ?? string.Empty;
        if (trimmed.Length == 0 || !AllowedPrefix().IsMatch(trimmed))
            throw new ArgumentException(PrefixFormatDescription, nameof(prefix));
        return trimmed.ToUpperInvariant();
    }

    /// <summary>Formats a series number, e.g. ("GST/", 4, 12) → "GST/0012"; grows naturally past MinDigits.</summary>
    public static string FormatSeriesNumber(string prefix, int minDigits, long counter)
    {
        if (counter < 1) throw new ArgumentOutOfRangeException(nameof(counter), "Counter must be at least 1.");
        var number = prefix + counter.ToString().PadLeft(Math.Max(1, minDigits), '0');
        if (number.Length > StorageMaxLength)
            throw new InvalidOperationException($"Invoice number '{number}' exceeds {StorageMaxLength} characters.");
        return number;
    }

    /// <summary>Key used for permanent, case-insensitive reservation of issued numbers.</summary>
    public static string ReservationKey(string invoiceNumber) => invoiceNumber.Trim().ToUpperInvariant();
}
