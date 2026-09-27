using System.Globalization;

namespace CarSpaManagement.Api.Application.Common;

public static class ShowroomDateHelper
{
    private static readonly TimeZoneInfo IndianZone = TimeZoneInfo.FindSystemTimeZoneById(
        OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata");

    private static readonly string[] SupportedDateFormats =
    [
        "yyyy-MM-dd",
        "yyyy-MM-ddTHH:mm:ss",
        "yyyy-MM-ddTHH:mm:ssZ",
        "yyyy-MM-ddTHH:mm:ss.fffZ",
        "yyyy-MM-ddTHH:mm:ss.fffffffZ",
        "yyyy-MM-ddTHH:mm:ss.fff",
        "yyyy-MM-ddTHH:mm:ss.fffffff",
        "dd-MM-yyyy",
        "dd/MM/yyyy",
        "yyyy/MM/dd",
        "d-M-yyyy",
        "d/M/yyyy",
        "M/d/yyyy",
        "MM/dd/yyyy"
    ];

    /// <summary>
    /// Normalizes any DateTime to UTC midnight date-only representation.
    /// Guarantees consistent date comparisons across ShowroomStaffAssignment, ShowroomStaffWorkSession, ShowroomDailyBill, and ShowroomDailyAttendance.
    /// </summary>
    public static DateTime ToUtcDate(DateTime dt)
    {
        return DateTime.SpecifyKind(dt.Date, DateTimeKind.Utc);
    }

    /// <summary>
    /// Parses any standard date representation (ISO 8601, YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY) to UTC midnight.
    /// Falls back to provided fallback or current UTC date if null or unparseable.
    /// </summary>
    public static DateTime ParseDateOrDefault(string? dateStr, DateTime? fallback = null)
    {
        if (string.IsNullOrWhiteSpace(dateStr))
        {
            return ToUtcDate(fallback ?? DateTime.UtcNow);
        }

        var trimmed = dateStr.Trim();

        if (DateTime.TryParseExact(trimmed, SupportedDateFormats, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var exactParsed))
        {
            return ToUtcDate(exactParsed);
        }

        if (DateTime.TryParse(trimmed, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var generalParsed))
        {
            return ToUtcDate(generalParsed);
        }

        return ToUtcDate(fallback ?? DateTime.UtcNow);
    }

    /// <summary>
    /// Parses a date string if present, otherwise returns null.
    /// </summary>
    public static DateTime? ParseDateOrNull(string? dateStr)
    {
        if (string.IsNullOrWhiteSpace(dateStr)) return null;

        var trimmed = dateStr.Trim();

        if (DateTime.TryParseExact(trimmed, SupportedDateFormats, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var exactParsed))
        {
            return ToUtcDate(exactParsed);
        }

        if (DateTime.TryParse(trimmed, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var generalParsed))
        {
            return ToUtcDate(generalParsed);
        }

        return null;
    }

    /// <summary>
    /// Returns current date in Indian Standard Time normalized to UTC midnight.
    /// </summary>
    public static DateTime GetTodayUtc()
    {
        try
        {
            var istNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, IndianZone);
            return DateTime.SpecifyKind(istNow.Date, DateTimeKind.Utc);
        }
        catch
        {
            var istNow = DateTime.UtcNow.AddMinutes(330);
            return DateTime.SpecifyKind(istNow.Date, DateTimeKind.Utc);
        }
    }
}
