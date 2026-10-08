using System.Reflection;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>Each company can upload its own picture for the login page.</summary>
public class LoginImageTests : IDisposable
{
    private static readonly byte[] Png = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D };
    private static readonly byte[] Jpeg = { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01 };

    private readonly string _webRoot = Path.Combine(Path.GetTempPath(), "LoginImg_" + Guid.NewGuid().ToString("N"));

    private sealed class TestWebHostEnvironment : IWebHostEnvironment
    {
        public string WebRootPath { get; set; } = string.Empty;
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "CarSpaManagement.Api";
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    public LoginImageTests() => Directory.CreateDirectory(_webRoot);

    public void Dispose()
    {
        if (Directory.Exists(_webRoot)) Directory.Delete(_webRoot, true);
    }

    private BusinessProfileService CreateService()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        return new BusinessProfileService(new AppDbContext(options), new TestWebHostEnvironment { WebRootPath = _webRoot }, new RecordingAuditLogService(), null);
    }

    private static IFormFile File(byte[] bytes, string name, string contentType) =>
        new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", name) { Headers = new HeaderDictionary(), ContentType = contentType };

    private string PhysicalPath(string relativeUrl) =>
        Path.Combine(_webRoot, relativeUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));

    [Fact]
    public async Task NewCompany_HasNoLoginPicture()
    {
        var service = CreateService();
        Assert.Null((await service.GetProfileAsync()).LoginImagePath);
        Assert.Null((await service.GetPublicProfileAsync()).LoginImagePath);
    }

    [Fact]
    public async Task Upload_StoresTheFile_AndExposesItOnTheLoginPageEndpoint()
    {
        var service = CreateService();

        var response = await service.UploadLoginImageAsync(File(Png, "banner.png", "image/png"));

        Assert.StartsWith("/uploads/login/login_", response.ImageUrl);
        Assert.True(System.IO.File.Exists(PhysicalPath(response.ImageUrl)));
        Assert.Equal(response.ImageUrl, response.Profile.LoginImagePath);
        Assert.Equal(response.ImageUrl, (await service.GetPublicProfileAsync()).LoginImagePath);
    }

    [Fact]
    public async Task ReplacingThePicture_RemovesThePreviousFile()
    {
        var service = CreateService();
        var first = await service.UploadLoginImageAsync(File(Png, "a.png", "image/png"));
        var second = await service.UploadLoginImageAsync(File(Jpeg, "b.jpg", "image/jpeg"));

        Assert.NotEqual(first.ImageUrl, second.ImageUrl);
        Assert.False(System.IO.File.Exists(PhysicalPath(first.ImageUrl)));
        Assert.True(System.IO.File.Exists(PhysicalPath(second.ImageUrl)));
    }

    [Fact]
    public async Task Remove_ClearsThePicture_AndDeletesTheFile()
    {
        var service = CreateService();
        var uploaded = await service.UploadLoginImageAsync(File(Png, "a.png", "image/png"));

        var profile = await service.RemoveLoginImageAsync();

        Assert.Null(profile.LoginImagePath);
        Assert.False(System.IO.File.Exists(PhysicalPath(uploaded.ImageUrl)));
        Assert.Null((await service.GetPublicProfileAsync()).LoginImagePath);
    }

    [Fact]
    public async Task Remove_NeverDeletesFilesItDidNotCreate()
    {
        var service = CreateService();
        var foreign = Path.Combine(_webRoot, "uploads", "login");
        Directory.CreateDirectory(foreign);
        var keep = Path.Combine(foreign, "somebody_elses.png");
        System.IO.File.WriteAllBytes(keep, Png);

        // Point the profile at a file that does not follow the naming this service uses.
        var uploaded = await service.UploadLoginImageAsync(File(Png, "a.png", "image/png"));
        await service.RemoveLoginImageAsync();

        Assert.True(System.IO.File.Exists(keep));
        Assert.False(System.IO.File.Exists(PhysicalPath(uploaded.ImageUrl)));
    }

    [Theory]
    [InlineData("notes.txt", "text/plain")]
    [InlineData("script.svg", "image/svg+xml")]
    [InlineData("photo.gif", "image/gif")]
    public async Task Upload_RejectsUnsupportedTypes(string name, string contentType)
    {
        var service = CreateService();
        await Assert.ThrowsAsync<ValidationException>(() => service.UploadLoginImageAsync(File(Png, name, contentType)));
    }

    [Fact]
    public async Task Upload_RejectsAFileThatIsNotReallyAnImage()
    {
        var service = CreateService();
        var fake = new byte[] { 0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00 };
        await Assert.ThrowsAsync<ValidationException>(() => service.UploadLoginImageAsync(File(fake, "evil.png", "image/png")));
    }

    [Fact]
    public async Task Upload_RejectsAnEmptyOrOversizedFile()
    {
        var service = CreateService();
        await Assert.ThrowsAsync<ValidationException>(() => service.UploadLoginImageAsync(File(Array.Empty<byte>(), "a.png", "image/png")));

        var big = new byte[5 * 1024 * 1024 + 1];
        Array.Copy(Png, big, Png.Length);
        await Assert.ThrowsAsync<ValidationException>(() => service.UploadLoginImageAsync(File(big, "a.png", "image/png")));
    }

    [Fact]
    public void Endpoints_RequireTheSettingsBusinessPermission_AndLimitUploadSize()
    {
        foreach (var name in new[] { nameof(BusinessProfileController.UploadLoginImage), nameof(BusinessProfileController.RemoveLoginImage) })
        {
            var method = typeof(BusinessProfileController).GetMethod(name)!;
            var permission = method.GetCustomAttribute<RequirePermissionAttribute>();
            Assert.NotNull(permission);
        }

        var upload = typeof(BusinessProfileController).GetMethod(nameof(BusinessProfileController.UploadLoginImage))!;
        var limit = (Microsoft.AspNetCore.Http.Metadata.IRequestSizeLimitMetadata)upload.GetCustomAttribute<RequestSizeLimitAttribute>()!;
        Assert.Equal(5 * 1024 * 1024, limit.MaxRequestBodySize);
    }
}
