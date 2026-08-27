using CarSpaManagement.Api.Controllers;
using Microsoft.AspNetCore.RateLimiting;
using System.Reflection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class RateLimitingConfigurationTests
{
    [Fact]
    public void AuthController_Login_HasRateLimitingAttribute()
    {
        var method = typeof(AuthController).GetMethod(nameof(AuthController.Login));
        Assert.NotNull(method);

        var attribute = method.GetCustomAttribute<EnableRateLimitingAttribute>();
        Assert.NotNull(attribute);
        Assert.Equal("auth-login", attribute.PolicyName);
    }

    [Fact]
    public void AuthController_BootstrapOwner_HasRateLimitingAttribute()
    {
        var method = typeof(AuthController).GetMethod(nameof(AuthController.BootstrapOwner));
        Assert.NotNull(method);

        var attribute = method.GetCustomAttribute<EnableRateLimitingAttribute>();
        Assert.NotNull(attribute);
        Assert.Equal("auth-bootstrap", attribute.PolicyName);
    }

    [Fact]
    public void PublicInvoicesController_HasRateLimitingAttribute()
    {
        var attribute = typeof(PublicInvoicesController).GetCustomAttribute<EnableRateLimitingAttribute>();
        Assert.NotNull(attribute);
        Assert.Equal("public-invoice", attribute.PolicyName);
    }

    [Fact]
    public void WhatsAppSettingsController_TestConnection_HasRateLimitingAttribute()
    {
        var method = typeof(WhatsAppSettingsController).GetMethod(nameof(WhatsAppSettingsController.TestConnection));
        Assert.NotNull(method);

        var attribute = method.GetCustomAttribute<EnableRateLimitingAttribute>();
        Assert.NotNull(attribute);
        Assert.Equal("whatsapp-test", attribute.PolicyName);
    }
}
