using System.Security.Cryptography;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>Phase 0 (P0-7): Development/placeholder configuration must not run as Production.</summary>
public class ProductionConfigurationTests
{
    private const string Placeholder = "Host=localhost;Port=5432;Database=E6CarSpaNew;Username=postgres;Password=CHANGE_ME";
    private const string RealLooking = "Host=db;Port=5432;Database=E6CarSpaNew;Username=carspa_app;Password=x9!Qm2#Lp7$Zr4";

    [Theory]
    [InlineData(Placeholder)]
    [InlineData("Host=db;Database=E6CarSpaNew;Username=carspa_app")]
    [InlineData("")]
    [InlineData(null)]
    public void Production_RejectsMissingOrPlaceholderConnectionString(string? connectionString)
    {
        Assert.Throws<InvalidOperationException>(() =>
            StartupConfigurationGuard.ValidateConnectionString(connectionString, isProduction: true));
    }

    [Fact]
    public void Production_AcceptsRealConnectionString_AndDevelopmentToleratesPlaceholder()
    {
        StartupConfigurationGuard.ValidateConnectionString(RealLooking, isProduction: true);
        StartupConfigurationGuard.ValidateConnectionString(Placeholder, isProduction: false);
    }

    [Fact]
    public void Production_WarnsWhenUsingPostgresSuperuser_OrHttpInvoiceLinks()
    {
        var warnings = StartupConfigurationGuard.GetWarnings(
            "Host=db;Database=x;Username=postgres;Password=real-password-1", isProduction: true, isDevelopment: false,
            listenUrls: "http://localhost:5298", publicInvoiceBaseUrl: "http://192.168.1.7:5173");

        Assert.Contains(warnings, w => w.Contains("superuser"));
        Assert.Contains(warnings, w => w.Contains("not HTTPS"));
    }

    [Fact]
    public void Production_WithLeastPrivilegeRoleAndHttps_HasNoWarnings()
    {
        var warnings = StartupConfigurationGuard.GetWarnings(RealLooking, true, false, "http://localhost:5298", "https://invoice.e6carspa.com");
        Assert.Empty(warnings);
    }

    [Theory]
    [InlineData("http://0.0.0.0:5298", true)]
    [InlineData("http://*:5298", true)]
    [InlineData("http://+:5298", true)]
    [InlineData("https://localhost:7012;http://localhost:5298", false)]
    [InlineData(null, false)]
    public void Development_ExposedOnNetwork_IsFlagged(string? urls, bool expectWarning)
    {
        var warnings = StartupConfigurationGuard.GetWarnings(Placeholder, isProduction: false, isDevelopment: true, urls, null);
        Assert.Equal(expectWarning, warnings.Any(w => w.Contains("Development mode")));
    }

    [Fact]
    public void ProductionHost_WithPlaceholderDatabasePassword_RefusesToStart()
    {
        using var factory = new WebApplicationFactory<AppDbContext>().WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Production");
            b.UseSetting("ConnectionStrings:DefaultConnection", Placeholder);
            b.UseSetting("Jwt:Key", Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)));
            b.UseSetting("WhatsApp:EncryptionKey", Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)));
        });

        var ex = Assert.ThrowsAny<Exception>(() => factory.CreateClient());
        Assert.Contains("placeholder", (ex.InnerException ?? ex).Message, StringComparison.OrdinalIgnoreCase);
    }
}
