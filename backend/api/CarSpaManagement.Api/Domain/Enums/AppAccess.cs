namespace CarSpaManagement.Api.Domain.Enums;

/// <summary>
/// Which of the apps a user may sign in to. On Trovo's platform each active user needs a licence of their type;
/// on a single-company server every user can use both apps.
/// </summary>
public enum AppAccess
{
    /// <summary>Windows and Android (the default, so existing users keep both).</summary>
    Both = 0,
    Android = 1,
    Windows = 2
}

/// <summary>The app a request comes from, as the app says at sign-in.</summary>
public static class ClientApp
{
    public const string Android = "android";
    public const string Windows = "windows";

    public static string? Normalize(string? app) => app?.Trim().ToLowerInvariant() switch
    {
        Android => Android,
        Windows => Windows,
        _ => null
    };

    /// <summary>Whether a user with this access may use the app. An app that did not say which it is needs "both".</summary>
    public static bool Allows(AppAccess access, string? app) => access == AppAccess.Both || Normalize(app) switch
    {
        Android => access == AppAccess.Android,
        Windows => access == AppAccess.Windows,
        _ => false
    };

    public static string Describe(AppAccess access) => access switch
    {
        AppAccess.Android => "the Android app",
        AppAccess.Windows => "the Windows app",
        _ => "both apps"
    };
}
