namespace CarSpaManagement.Api.Application.Common;

public static class PasswordPolicyValidator
{
    public const int MinimumLength = 8;

    public static (bool IsValid, string? ErrorMessage) Validate(string? password, string? confirmPassword, string? username)
    {
        if (string.IsNullOrWhiteSpace(password))
        {
            return (false, "Password is required.");
        }

        if (password.Length < MinimumLength)
        {
            return (false, $"Password must be at least {MinimumLength} characters long.");
        }

        if (confirmPassword != null && password != confirmPassword)
        {
            return (false, "Password and confirmation password do not match.");
        }

        if (!string.IsNullOrWhiteSpace(username) && string.Equals(password.Trim(), username.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return (false, "Password cannot be the same as the username.");
        }

        return (true, null);
    }
}
