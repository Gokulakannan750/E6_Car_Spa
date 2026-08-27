using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using Microsoft.Extensions.Options;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class JwtOptionsAndTokenServiceTests
{
    [Fact]
    public void Validate_WithValidOptions_Succeeds()
    {
        var options = new JwtOptions
        {
            Key = "a_very_secure_and_sufficiently_long_jwt_signing_key_32_bytes",
            Issuer = "E6CarSpa",
            Audience = "E6CarSpaDesktop",
            ExpirationMinutes = 1440
        };

        // Should not throw
        JwtOptions.Validate(options, isProduction: true);
        JwtOptions.Validate(options, isProduction: false);
    }

    [Fact]
    public void Validate_WithExactly32CharacterKey_Succeeds()
    {
        var options = new JwtOptions
        {
            Key = "12345678901234567890123456789012", // exactly 32 characters
            Issuer = "E6CarSpa",
            Audience = "E6CarSpaDesktop",
            ExpirationMinutes = 60
        };

        JwtOptions.Validate(options, isProduction: true);
        JwtOptions.Validate(options, isProduction: false);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_WithMissingKey_ThrowsInvalidOperationException(string? key)
    {
        var options = new JwtOptions
        {
            Key = key!,
            Issuer = "E6CarSpa",
            Audience = "E6CarSpaDesktop"
        };

        var ex = Assert.Throws<InvalidOperationException>(() => JwtOptions.Validate(options, isProduction: true));
        Assert.Contains("JWT Signing Key is not configured", ex.Message);
    }

    [Theory]
    [InlineData("too_short_key")]
    [InlineData("1234567890123456789012345678901")] // 31 chars
    public void Validate_WithShortKey_ThrowsInvalidOperationException(string shortKey)
    {
        var options = new JwtOptions
        {
            Key = shortKey,
            Issuer = "E6CarSpa",
            Audience = "E6CarSpaDesktop"
        };

        var ex = Assert.Throws<InvalidOperationException>(() => JwtOptions.Validate(options, isProduction: true));
        Assert.Contains("at least 32 characters", ex.Message);
    }

    [Theory]
    [InlineData("CHANGE_ME")]
    [InlineData("YOUR_JWT_KEY")]
    [InlineData("<REDACTED>")]
    public void Validate_WithPlaceholderUnder32Chars_ThrowsInvalidOperationException(string placeholder)
    {
        var options = new JwtOptions
        {
            Key = placeholder,
            Issuer = "E6CarSpa",
            Audience = "E6CarSpaDesktop"
        };

        var ex = Assert.Throws<InvalidOperationException>(() => JwtOptions.Validate(options, isProduction: true));
        Assert.Contains("at least 32 characters", ex.Message);
    }

    [Theory]
    [InlineData("CHANGE_ME_IN_PRODUCTION_SUPPLIED_EXTERNALLY")]
    [InlineData("REPLACE_WITH_SECRET_KEY_FOR_PRODUCTION_USAGE_NOW")]
    [InlineData("YOUR_JWT_KEY_SHOULD_BE_PUT_HERE_BEFORE_DEPLOYMENT")]
    [InlineData("[REDACTED_PROD_SECRET_KEY_FOR_E6_CAR_SPA_SYSTEM]")]
    [InlineData("some_prefix_default_secret_with_sufficient_length_32_bytes")]
    public void Validate_WithPlaceholderGreaterOrEqual32CharsInProduction_ThrowsInvalidOperationException(string placeholderKey)
    {
        var options = new JwtOptions
        {
            Key = placeholderKey,
            Issuer = "E6CarSpa",
            Audience = "E6CarSpaDesktop"
        };

        var ex = Assert.Throws<InvalidOperationException>(() => JwtOptions.Validate(options, isProduction: true));
        Assert.Contains("placeholder", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Validate_WithValidProductionSecret_Succeeds()
    {
        var options = new JwtOptions
        {
            Key = "a9f8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8",
            Issuer = "E6CarSpa",
            Audience = "E6CarSpaDesktop",
            ExpirationMinutes = 1440
        };

        JwtOptions.Validate(options, isProduction: true);
    }

    [Fact]
    public void GenerateToken_WithValidUser_ReturnsValidJwt()
    {
        var options = Options.Create(new JwtOptions
        {
            Key = "a_very_secure_and_sufficiently_long_jwt_signing_key_32_bytes",
            Issuer = "E6CarSpa",
            Audience = "E6CarSpaDesktop",
            ExpirationMinutes = 60
        });

        var service = new JwtTokenService(options);
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Admin User",
            Username = "admin",
            Role = UserRole.Owner,
            IsActive = true
        };

        var token = service.GenerateToken(user);

        Assert.NotNull(token);
        Assert.NotEmpty(token);
        Assert.Contains(".", token); // Standard JWT structure: header.payload.signature
    }

    [Fact]
    public void GenerateToken_WithInvalidKey_ThrowsException()
    {
        var options = Options.Create(new JwtOptions
        {
            Key = "",
            Issuer = "E6CarSpa",
            Audience = "E6CarSpaDesktop"
        });

        var service = new JwtTokenService(options);
        var user = new User { Id = Guid.NewGuid(), FullName = "Admin", Username = "admin", Role = UserRole.Owner };

        Assert.Throws<InvalidOperationException>(() => service.GenerateToken(user));
    }
}
