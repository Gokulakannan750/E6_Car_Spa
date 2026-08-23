namespace CarSpaManagement.Api.Application.Common;

public static class ShowroomDateHelper
{
    /// <summary>
    /// Normalizes any DateTime to UTC midnight date-only representation.
    /// Guarantees consistent date comparisons across ShowroomStaffAssignment, ShowroomDailyBill, and ShowroomDailyAttendance.
    /// </summary>
    public static DateTime ToUtcDate(DateTime dt)
    {
        return DateTime.SpecifyKind(dt.Date, DateTimeKind.Utc);
    }
}
