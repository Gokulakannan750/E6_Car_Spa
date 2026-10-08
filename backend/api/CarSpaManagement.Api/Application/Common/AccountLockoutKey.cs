namespace CarSpaManagement.Api.Application.Common;

/// <summary>
/// Failed sign-ins are counted per company and username, so one company's lockouts never affect another
/// company's users who happen to use the same username.
/// </summary>
public static class AccountLockoutKey
{
    public static string For(string companyCode, string normalizedUsername) => $"{companyCode}|{normalizedUsername}";
}
