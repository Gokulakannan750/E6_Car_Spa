using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Settings;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// Documents and company details must come only from the company's own profile: a company that has not filled in a
/// detail gets nothing in its place, and a new database starts with no company-specific content.
/// </summary>
public class DocumentBrandingTests
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

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static BusinessProfileService CreateProfileService(AppDbContext db, IConfiguration? configuration = null) =>
        new(db, new TestWebHostEnvironment(), new RecordingAuditLogService(), configuration);

    private static readonly string[] LegacyBuiltInText =
    {
        "E6 Car Spa", "e6carspa", "Geetha", "Sakthi", "9578749449", "Perundurai", "e6-logo",
        "Premium Auto Detailing", "vehicle detailing services"
    };

    private static void AssertNoLegacyText(string value)
    {
        foreach (var legacy in LegacyBuiltInText)
            Assert.DoesNotContain(legacy, value, StringComparison.OrdinalIgnoreCase);
    }

    // ── A new database starts neutral ───────────────────────────────────────────────

    [Fact]
    public async Task NewDatabase_StartsWithAnEmptyProfileAndNoLogo()
    {
        using var db = CreateDb();

        var profile = await CreateProfileService(db).GetProfileAsync();

        Assert.Equal(string.Empty, profile.BusinessName);
        Assert.Equal(string.Empty, profile.AddressLine1);
        Assert.Null(profile.AddressLine2);
        Assert.Equal(string.Empty, profile.City);
        Assert.Equal(string.Empty, profile.State);
        Assert.Equal(string.Empty, profile.PostalCode);
        Assert.Equal(string.Empty, profile.Phone);
        Assert.Equal(string.Empty, profile.Email);
        Assert.Null(profile.LogoPath);
        Assert.Null(profile.Tagline);
        Assert.Null(profile.BrandColor);
        Assert.Null(profile.TermsAndConditions);
        AssertNoLegacyText(System.Text.Json.JsonSerializer.Serialize(profile));
    }

    [Fact]
    public async Task NewDatabase_UsesTheDeploymentsOwnDefaultProfileConfiguration()
    {
        using var db = CreateDb();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["DefaultBusinessProfile:BusinessName"] = "Sunrise Detailing",
            ["DefaultBusinessProfile:City"] = "Pune",
            ["DefaultBusinessProfile:Tagline"] = "Shine every day",
            ["DefaultBusinessProfile:BrandColor"] = "#0f766e",
            ["DefaultBusinessProfile:LogoPath"] = "/uploads/logos/logo_sunrise.png",
        }).Build();

        var profile = await CreateProfileService(db, configuration).GetProfileAsync();

        Assert.Equal("Sunrise Detailing", profile.BusinessName);
        Assert.Equal("Pune", profile.City);
        Assert.Equal("Shine every day", profile.Tagline);
        Assert.Equal("#0F766E", profile.BrandColor);
        Assert.Equal("/uploads/logos/logo_sunrise.png", profile.LogoPath);
    }

    [Fact]
    public async Task NewDatabase_IgnoresAnInvalidConfiguredBrandColour()
    {
        using var db = CreateDb();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["DefaultBusinessProfile:BrandColor"] = "red",
        }).Build();

        var profile = await CreateProfileService(db, configuration).GetProfileAsync();

        Assert.Null(profile.BrandColor);
    }

    // ── Tagline and brand colour in Company Settings ─────────────────────────────────

    private static UpdateBusinessProfileRequest ValidUpdate(Action<UpdateBusinessProfileRequest>? tweak = null)
    {
        var request = new UpdateBusinessProfileRequest
        {
            BusinessName = "Sunrise Detailing",
            AddressLine1 = "12 Park Road",
            City = "Pune",
            State = "Maharashtra",
            PostalCode = "411001",
            Phone = "9123456789",
            Email = "hello@sunrise.example",
        };
        tweak?.Invoke(request);
        return request;
    }

    [Fact]
    public async Task Update_SavesTaglineAndNormalisesTheBrandColour()
    {
        using var db = CreateDb();
        var service = CreateProfileService(db);

        var saved = await service.UpdateProfileAsync(ValidUpdate(r =>
        {
            r.Tagline = "  Shine every day  ";
            r.BrandColor = " #a11a1a ";
            r.TermsAndConditions = "Pay within 7 days.";
        }));

        Assert.Equal("Shine every day", saved.Tagline);
        Assert.Equal("#A11A1A", saved.BrandColor);
        Assert.Equal("Pay within 7 days.", saved.TermsAndConditions);
    }

    [Fact]
    public async Task Update_LeavesTaglineAndColourAloneWhenNotSent_AndClearsThemWhenEmpty()
    {
        using var db = CreateDb();
        var service = CreateProfileService(db);
        await service.UpdateProfileAsync(ValidUpdate(r => { r.Tagline = "Shine"; r.BrandColor = "#112233"; }));

        // An older client that does not know these fields must not wipe them.
        var untouched = await service.UpdateProfileAsync(ValidUpdate());
        Assert.Equal("Shine", untouched.Tagline);
        Assert.Equal("#112233", untouched.BrandColor);

        var cleared = await service.UpdateProfileAsync(ValidUpdate(r => { r.Tagline = ""; r.BrandColor = ""; }));
        Assert.Null(cleared.Tagline);
        Assert.Null(cleared.BrandColor);
    }

    [Theory]
    [InlineData("red")]
    [InlineData("#12345")]
    [InlineData("#GGGGGG")]
    [InlineData("112233")]
    public async Task Update_RejectsABrandColourThatIsNotARrggbbCode(string colour)
    {
        using var db = CreateDb();
        var service = CreateProfileService(db);

        await Assert.ThrowsAsync<ValidationException>(() => service.UpdateProfileAsync(ValidUpdate(r => r.BrandColor = colour)));
    }

    // ── The invoice PDF ─────────────────────────────────────────────────────────────

    private static Invoice SampleInvoice() => new()
    {
        Id = Guid.NewGuid(),
        InvoiceNumber = "INV-2026-000001",
        InvoiceDate = new DateTime(2026, 10, 8),
        Status = InvoiceStatus.Generated,
        IsGstEnabled = true,
        Customer = new Customer { Name = "Test Customer", PhoneNumber = "9000000000" },
        Vehicle = new Vehicle { RegistrationNumber = "TN01AB1234", Make = "Hyundai", Model = "Creta" },
        TotalAmount = 1000m,
        PaidAmount = 0m,
        BalanceAmount = 1000m,
        Subtotal = 1000m,
        InvoiceItems = new List<InvoiceItem> { new() { Id = Guid.NewGuid(), Description = "Wash", Quantity = 1, UnitPrice = 1000m, TotalAmount = 1000m } },
    };

    [Fact]
    public void Logo_NoneConfigured_MeansNoLogo_EvenIfALegacyLogoFileExists()
    {
        var webRoot = Path.Combine(Path.GetTempPath(), "branding_" + Guid.NewGuid().ToString("N"));
        var logos = Directory.CreateDirectory(Path.Combine(webRoot, "uploads", "logos"));
        try
        {
            File.WriteAllBytes(Path.Combine(logos.FullName, "e6-logo.png"), new byte[] { 0x89, 0x50, 0x4E, 0x47 });
            var generator = new InvoicePdfGenerator(new TestWebHostEnvironment { WebRootPath = webRoot });
            var resolve = typeof(InvoicePdfGenerator).GetMethod("ResolveLogoBytes",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;

            Assert.Null(resolve.Invoke(generator, new object?[] { null }));
            Assert.Null(resolve.Invoke(generator, new object?[] { "   " }));
        }
        finally
        {
            Directory.Delete(webRoot, recursive: true);
        }
    }

    [Theory]
    [InlineData("#a11a1a", "#A11A1A")]
    [InlineData(" #0F766E ", "#0F766E")]
    public void AccentColour_UsesTheCompanysOwn(string configured, string expected) =>
        Assert.Equal(expected, InvoicePdfGenerator.ResolveAccentColor(configured));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("red")]
    [InlineData("#12")]
    public void AccentColour_FallsBackToTheNeutralColour_NotAnyCompanysBrand(string? configured)
    {
        Assert.Equal(InvoicePdfGenerator.DefaultAccentColor, InvoicePdfGenerator.ResolveAccentColor(configured));
        Assert.NotEqual("#A11A1A", InvoicePdfGenerator.DefaultAccentColor);
    }

    // ── The public invoice page ─────────────────────────────────────────────────────

    private static InvoiceService CreateInvoiceService(AppDbContext db) =>
        new(db, new RecordingAuditLogService(), new ConfigurationBuilder().Build(),
            new HttpContextAccessor { HttpContext = new DefaultHttpContext() }, new NoopWhatsAppService(),
            new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>());

    private static async Task<Guid> SeedFinalizedInvoiceAsync(AppDbContext db)
    {
        var customer = new Customer { Id = Guid.NewGuid(), Name = "Public Customer", PhoneNumber = "9000000001", CreatedAt = DateTime.UtcNow };
        var vehicle = new Vehicle { Id = Guid.NewGuid(), RegistrationNumber = "TN02CD5678", Make = "Honda", Model = "City", CustomerId = customer.Id, CreatedAt = DateTime.UtcNow };
        var jobCard = new JobCard { Id = Guid.NewGuid(), JobCardNumber = "JC-1", CustomerId = customer.Id, VehicleId = vehicle.Id, Status = JobCardStatus.Ready, CreatedAt = DateTime.UtcNow };
        var invoice = new Invoice
        {
            Id = Guid.NewGuid(), InvoiceNumber = "INV-2026-000002", InvoiceDate = DateTime.UtcNow.Date, CustomerId = customer.Id,
            VehicleId = vehicle.Id, JobCardId = jobCard.Id, Status = InvoiceStatus.Generated, TotalAmount = 500m, BalanceAmount = 500m,
            CreatedAt = DateTime.UtcNow
        };
        db.AddRange(customer, vehicle, jobCard, invoice);
        await db.SaveChangesAsync();
        return invoice.Id;
    }

    private static async Task<PublicInvoiceDtoHolder> OpenPublicInvoiceAsync(AppDbContext db)
    {
        var invoiceId = await SeedFinalizedInvoiceAsync(db);
        var service = CreateInvoiceService(db);
        var link = await service.CreatePublicLinkAsync(invoiceId);
        var token = link.Url.TrimEnd('/').Split('/').Last();
        var dto = await service.GetPublicInvoiceByTokenAsync(token);
        Assert.NotNull(dto);
        return new PublicInvoiceDtoHolder(dto!);
    }

    private sealed record PublicInvoiceDtoHolder(CarSpaManagement.Api.Application.DTOs.Invoices.PublicInvoiceDto Dto);

    [Fact]
    public async Task PublicInvoice_ShowsTheCompanysOwnDetailsTaglineTermsAndColour()
    {
        using var db = CreateDb();
        db.BusinessProfiles.Add(new BusinessProfile
        {
            SingletonKey = 1, BusinessName = "Sunrise Detailing", AddressLine1 = "12 Park Road", City = "Pune", State = "Maharashtra",
            PostalCode = "411001", Phone = "9123456789", Email = "hello@sunrise.example", LogoPath = "/uploads/logos/logo_sunrise.png",
            Tagline = "Shine every day", BrandColor = "#0F766E", TermsAndConditions = "Pay within 7 days."
        });
        await db.SaveChangesAsync();

        var dto = (await OpenPublicInvoiceAsync(db)).Dto;

        Assert.Equal("Sunrise Detailing", dto.Business.BusinessName);
        Assert.Equal("Pune", dto.Business.City);
        Assert.Equal("/uploads/logos/logo_sunrise.png", dto.Business.LogoUrl);
        Assert.Equal("Shine every day", dto.Business.Tagline);
        Assert.Equal("#0F766E", dto.Business.BrandColor);
        Assert.Equal("Pay within 7 days.", dto.TermsAndConditions);
        AssertNoLegacyText(System.Text.Json.JsonSerializer.Serialize(dto));
    }

    [Fact]
    public async Task PublicInvoice_WithAnEmptyProfile_ShowsNothingInsteadOfAnotherCompanysDetails()
    {
        using var db = CreateDb();
        db.BusinessProfiles.Add(new BusinessProfile { SingletonKey = 1 });
        await db.SaveChangesAsync();

        var dto = (await OpenPublicInvoiceAsync(db)).Dto;

        Assert.Equal(string.Empty, dto.Business.BusinessName);
        Assert.Null(dto.Business.LogoUrl);
        Assert.Null(dto.Business.Tagline);
        Assert.Null(dto.Business.BrandColor);
        Assert.Null(dto.TermsAndConditions);
        AssertNoLegacyText(System.Text.Json.JsonSerializer.Serialize(dto));
    }

    [Fact]
    public async Task PublicInvoice_WithNoProfileRowAtAll_AlsoShowsNothing()
    {
        using var db = CreateDb();

        var dto = (await OpenPublicInvoiceAsync(db)).Dto;

        Assert.Equal(string.Empty, dto.Business.BusinessName);
        Assert.Null(dto.Business.LogoUrl);
        Assert.Null(dto.TermsAndConditions);
        AssertNoLegacyText(System.Text.Json.JsonSerializer.Serialize(dto));
    }
}
