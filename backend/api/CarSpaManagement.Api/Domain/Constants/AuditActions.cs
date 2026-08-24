namespace CarSpaManagement.Api.Domain.Constants;

public static class AuditActions
{
    public const string LoginSuccess = "LOGIN_SUCCESS";
    public const string LoginFailed = "LOGIN_FAILED";

    public const string UserCreated = "USER_CREATED";
    public const string UserActivated = "USER_ACTIVATED";
    public const string UserDeactivated = "USER_DEACTIVATED";
    public const string PermissionChanged = "PERMISSION_CHANGED";

    public const string Create = "CREATE";
    public const string Update = "UPDATE";
    public const string Delete = "DELETE";

    public const string CreateDraft = "CREATE_DRAFT";
    public const string UpdateDraft = "UPDATE_DRAFT";
    public const string Generate = "GENERATE";
    public const string Cancel = "CANCEL";

    public const string PaymentRecorded = "PAYMENT_RECORDED";
    public const string PaymentVoided = "PAYMENT_VOIDED";

    public const string ShowroomCreated = "SHOWROOM_CREATED";
    public const string ShowroomUpdated = "SHOWROOM_UPDATED";
    public const string ShowroomActivated = "SHOWROOM_ACTIVATED";
    public const string ShowroomDeactivated = "SHOWROOM_DEACTIVATED";

    public const string AttendanceConfirmed = "ATTENDANCE_CONFIRMED";
    public const string AttendanceUnlocked = "ATTENDANCE_UNLOCKED";
    public const string AttendanceCorrected = "ATTENDANCE_CORRECTED";

    public const string AdvanceCreated = "ADVANCE_CREATED";
    public const string AdvanceSettled = "ADVANCE_SETTLED";
    public const string AdvanceObsoleted = "ADVANCE_OBSOLETED";

    public const string BusinessProfileUpdated = "BUSINESS_PROFILE_UPDATED";
    public const string LogoChanged = "LOGO_CHANGED";
    public const string LogoRemoved = "LOGO_REMOVED";

    public const string StatusChanged = "STATUS_CHANGED";
}
