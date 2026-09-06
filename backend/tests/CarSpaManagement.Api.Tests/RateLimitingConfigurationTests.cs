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

    [Fact]
    public void BusinessProfileController_UploadLogo_HasFileUploadRateLimitingAttribute()
    {
        var method = typeof(BusinessProfileController).GetMethod(nameof(BusinessProfileController.UploadLogo));
        Assert.NotNull(method);

        var attribute = method.GetCustomAttribute<EnableRateLimitingAttribute>();
        Assert.NotNull(attribute);
        Assert.Equal("file-upload", attribute.PolicyName);
    }

    [Theory]
    [InlineData(nameof(ReportsController.GetSalesReport))]
    [InlineData(nameof(ReportsController.GetPaymentCollectionReport))]
    [InlineData(nameof(ReportsController.GetOutstandingInvoicesReport))]
    [InlineData(nameof(ReportsController.GetGstReport))]
    [InlineData(nameof(ReportsController.GetJobCardReport))]
    [InlineData(nameof(ReportsController.GetShowroomReport))]
    [InlineData(nameof(ReportsController.GetStaffProductivityReport))]
    [InlineData(nameof(ReportsController.GetStaffAdvancesReport))]
    public void ReportsController_HeavyReports_HaveReportsHeavyRateLimitingAttribute(string methodName)
    {
        var method = typeof(ReportsController).GetMethod(methodName);
        Assert.NotNull(method);

        var attribute = method.GetCustomAttribute<EnableRateLimitingAttribute>();
        Assert.NotNull(attribute);
        Assert.Equal("reports-heavy", attribute.PolicyName);
    }

    [Fact]
    public void ReportsController_DashboardSummary_DoesNotHaveHeavyReportRateLimit()
    {
        var method = typeof(ReportsController).GetMethod(nameof(ReportsController.GetDashboardSummary));
        Assert.NotNull(method);

        var attribute = method.GetCustomAttribute<EnableRateLimitingAttribute>();
        // Dashboard summary should NOT be throttled by reports-heavy
        Assert.Null(attribute);
    }
}
