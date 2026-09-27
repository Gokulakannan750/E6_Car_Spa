using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs.Settings;

public record SystemPreferenceDto(
    string DateFormat,
    string TimeFormat,
    string CurrencySymbol,
    int DecimalPrecision,
    int DefaultPrintCopies,
    bool AutoPrintReceipt,
    int RefreshInterval,
    DateTime? UpdatedAt
);

public class UpdateSystemPreferenceRequest : IValidatableObject
{
    [Required(ErrorMessage = "Date format is required.")]
    public string DateFormat { get; set; } = "DD/MM/YYYY";

    [Required(ErrorMessage = "Time format is required.")]
    public string TimeFormat { get; set; } = "12h";

    [Required(ErrorMessage = "Currency symbol is required.")]
    public string CurrencySymbol { get; set; } = "₹";

    public int DecimalPrecision { get; set; } = 2;

    public int DefaultPrintCopies { get; set; } = 1;

    public bool AutoPrintReceipt { get; set; } = true;

    public int RefreshInterval { get; set; } = 30;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var validDateFormats = new[] { "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD" };
        if (!validDateFormats.Contains(DateFormat, StringComparer.OrdinalIgnoreCase))
        {
            yield return new ValidationResult(
                $"Date format must be one of: {string.Join(", ", validDateFormats)}.",
                [nameof(DateFormat)]);
        }

        var validTimeFormats = new[] { "12h", "24h" };
        if (!validTimeFormats.Contains(TimeFormat, StringComparer.OrdinalIgnoreCase))
        {
            yield return new ValidationResult(
                $"Time format must be one of: {string.Join(", ", validTimeFormats)}.",
                [nameof(TimeFormat)]);
        }

        var validCurrencySymbols = new[] { "₹", "$", "€" };
        if (!validCurrencySymbols.Contains(CurrencySymbol))
        {
            yield return new ValidationResult(
                $"Currency symbol must be one of: {string.Join(", ", validCurrencySymbols)}.",
                [nameof(CurrencySymbol)]);
        }

        var validDecimals = new[] { 0, 2 };
        if (!validDecimals.Contains(DecimalPrecision))
        {
            yield return new ValidationResult(
                "Decimal precision must be either 0 or 2.",
                [nameof(DecimalPrecision)]);
        }

        var validPrintCopies = new[] { 1, 2, 3 };
        if (!validPrintCopies.Contains(DefaultPrintCopies))
        {
            yield return new ValidationResult(
                "Default print copies must be 1, 2, or 3.",
                [nameof(DefaultPrintCopies)]);
        }

        var validRefreshIntervals = new[] { 0, 15, 30, 60 };
        if (!validRefreshIntervals.Contains(RefreshInterval))
        {
            yield return new ValidationResult(
                "Refresh interval must be 0 (Manual), 15, 30, or 60 seconds.",
                [nameof(RefreshInterval)]);
        }
    }
}
