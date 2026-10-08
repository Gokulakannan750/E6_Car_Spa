using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Settings;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>Each company chooses its own app accent, sidebar/login and document colours.</summary>
public class AppearanceTests
{
    private sealed class TestWebHostEnvironment : IWebHostEnvironment
    {
        public string WebRootPath { get; set; } = string.Empty;
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "CarSpaManagement.Api";
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private static (AppDbContext Db, BusinessProfileService Service) Create()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);
        return (db, new BusinessProfileService(db, new TestWebHostEnvironment(), new RecordingAuditLogService(), null));
    }

    [Fact]
    public async Task NewCompany_StartsWithNoColoursChosen()
    {
        var (_, service) = Create();

        var profile = await service.GetProfileAsync();
        var publicProfile = await service.GetPublicProfileAsync();

        Assert.Null(profile.AppColor);
        Assert.Null(profile.SidebarColor);
        Assert.Null(publicProfile.AppColor);
        Assert.Null(publicProfile.SidebarColor);
    }

    [Fact]
    public async Task SavingColours_NormalisesThem_AndExposesThemOnTheLoginPageEndpoint()
    {
        var (_, service) = Create();

        var saved = await service.UpdateAppearanceAsync(new UpdateAppearanceRequest
        {
            AppColor = " #0f766e ",
            SidebarColor = "#112233",
            BrandColor = "#a11a1a",
        });

        Assert.Equal("#0F766E", saved.AppColor);
        Assert.Equal("#112233", saved.SidebarColor);
        Assert.Equal("#A11A1A", saved.BrandColor);

        var publicProfile = await service.GetPublicProfileAsync();
        Assert.Equal("#0F766E", publicProfile.AppColor);
        Assert.Equal("#112233", publicProfile.SidebarColor);
    }

    [Fact]
    public async Task OmittedColoursAreLeftAlone_AndEmptyOnesAreCleared()
    {
        var (_, service) = Create();
        await service.UpdateAppearanceAsync(new UpdateAppearanceRequest { AppColor = "#111111", SidebarColor = "#222222", BrandColor = "#333333" });

        var onlyApp = await service.UpdateAppearanceAsync(new UpdateAppearanceRequest { AppColor = "#444444" });
        Assert.Equal("#444444", onlyApp.AppColor);
        Assert.Equal("#222222", onlyApp.SidebarColor);
        Assert.Equal("#333333", onlyApp.BrandColor);

        var cleared = await service.UpdateAppearanceAsync(new UpdateAppearanceRequest { SidebarColor = "" });
        Assert.Null(cleared.SidebarColor);
        Assert.Equal("#444444", cleared.AppColor);
    }

    [Theory]
    [InlineData("red")]
    [InlineData("#12345")]
    [InlineData("#GGGGGG")]
    [InlineData("123456")]
    public async Task InvalidColour_IsRejected_AndNothingIsChanged(string bad)
    {
        var (_, service) = Create();
        await service.UpdateAppearanceAsync(new UpdateAppearanceRequest { AppColor = "#111111", SidebarColor = "#222222" });

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.UpdateAppearanceAsync(new UpdateAppearanceRequest { AppColor = "#999999", SidebarColor = bad }));

        var after = await service.GetProfileAsync();
        Assert.Equal("#111111", after.AppColor);
        Assert.Equal("#222222", after.SidebarColor);
    }
}
