using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class PasswordSecurityTests
{
    [Fact]
    public void PasswordHasher_HashesAndVerifiesPassword()
    {
        var hasher = new PasswordHasherService();
        var user = new User { Id = Guid.NewGuid(), Username = "testuser" };

        var hash = hasher.HashPassword(user, "SecurePass123!");
        Assert.NotEmpty(hash);
        Assert.NotEqual("SecurePass123!", hash);

        var isValid = hasher.VerifyPassword(user, hash, "SecurePass123!");
        Assert.True(isValid);

        var isInvalid = hasher.VerifyPassword(user, hash, "WrongPass123!");
        Assert.False(isInvalid);
    }

    [Theory]
    [InlineData("", false, "Password is required.")]
    [InlineData(null, false, "Password is required.")]
    [InlineData("short", false, "at least 8 characters")]
    [InlineData("admin123", true, null)]
    public void PasswordPolicy_EnforcesMinimumLength(string? password, bool expectedValid, string? expectedMessagePart)
    {
        var (isValid, errorMessage) = PasswordPolicyValidator.Validate(password, password, "someuser");

        Assert.Equal(expectedValid, isValid);
        if (!expectedValid && expectedMessagePart != null)
        {
            Assert.Contains(expectedMessagePart, errorMessage ?? "");
        }
    }

    [Fact]
    public void PasswordPolicy_RejectsPasswordMatchingUsername()
    {
        var (isValid, errorMessage) = PasswordPolicyValidator.Validate("adminuser", "adminuser", "adminuser");

        Assert.False(isValid);
        Assert.Contains("same as the username", errorMessage);
    }

    [Fact]
    public void PasswordPolicy_RejectsMismatchedConfirmation()
    {
        var (isValid, errorMessage) = PasswordPolicyValidator.Validate("StrongPass123", "DifferentPass123", "testuser");

        Assert.False(isValid);
        Assert.Contains("do not match", errorMessage);
    }
}
