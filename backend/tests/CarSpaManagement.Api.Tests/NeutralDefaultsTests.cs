using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>Built-in defaults must not name any one company: each deployment supplies its own values.</summary>
public class NeutralDefaultsTests
{
    private static IConfiguration Config(string? publicInvoiceBaseUrl)
    {
        var values = new Dictionary<string, string?> { ["PublicInvoiceBaseUrl"] = publicInvoiceBaseUrl };
        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }

    [Fact]
    public void JwtOptions_DefaultNames_AreNotCompanySpecific()
    {
        var options = new JwtOptions();
        Assert.DoesNotContain("E6", options.Issuer, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("E6", options.Audience, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void WhatsAppConfiguration_DefaultTemplateNames_AreNotCompanySpecific()
    {
        var config = new WhatsAppConfiguration();
        Assert.Equal("invoice_generated", config.InvoiceTemplateName);
        Assert.Equal("payment_completed", config.PaymentCompletedTemplateName);
    }

    [Theory]
    [InlineData("https://invoices.sunrise.example", "https://invoices.sunrise.example")]
    [InlineData("https://invoices.sunrise.example/", "https://invoices.sunrise.example")]
    [InlineData("  https://invoices.sunrise.example//  ", "https://invoices.sunrise.example")]
    public void PublicLinks_UsesTheConfiguredAddress(string configured, string expected)
    {
        Assert.Equal(expected, PublicLinks.BaseUrl(Config(configured)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void PublicLinks_FallsBackToTheDevelopmentAddress_WhenNothingIsConfigured(string? configured)
    {
        Assert.Equal(PublicLinks.DevelopmentFallback, PublicLinks.BaseUrl(Config(configured)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void Production_RefusesToStart_WithoutAPublicInvoiceAddress(string? configured)
    {
        var ex = Assert.Throws<InvalidOperationException>(() =>
            StartupConfigurationGuard.ValidatePublicInvoiceBaseUrl(configured, isProduction: true));
        Assert.Contains("PublicInvoiceBaseUrl", ex.Message);
    }

    [Fact]
    public void Production_StartsNormally_WhenAnAddressIsConfigured()
    {
        StartupConfigurationGuard.ValidatePublicInvoiceBaseUrl("https://invoices.sunrise.example", isProduction: true);
    }

    [Fact]
    public void Development_DoesNotNeedAPublicInvoiceAddress()
    {
        StartupConfigurationGuard.ValidatePublicInvoiceBaseUrl(null, isProduction: false);
    }

    [Fact]
    public void SharedAppSettings_ContainNoCompanyNameOrAddress()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
        var text = File.ReadAllText(path);
        Assert.DoesNotContain("e6carspa", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("E6CarSpa", text, StringComparison.Ordinal);
    }
}
