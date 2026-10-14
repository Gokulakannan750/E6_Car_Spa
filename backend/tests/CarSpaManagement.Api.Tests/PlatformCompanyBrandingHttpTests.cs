using System.Net;
using System.Text.Json;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Platform;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>The company's name on the sign-in page, before and after the Owner saves Company Settings.</summary>
public class PlatformCompanyBrandingHttpTests(PlatformApiHost host) : IClassFixture<PlatformApiHost>
{
    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    [PostgresFact]
    public async Task ASignedUpCompany_StartsWithItsSignUpDetails_AndTheSignInPageShowsItsName()
    {
        var email = $"brand-{Guid.NewGuid():N}@sunrise.test";
        var mobile = $"9{Random.Shared.Next(100_000_000, 999_999_999)}";
        var trial = await Json(await host.SendAsync(HttpMethod.Post, "/api/public/signup", null, new
        {
            business = new { name = "Gokul Detailing", ownerName = "Gokul", mobile, email, city = "Erode", state = "Tamil Nadu", gstin = (string?)null },
            startTrial = true,
            acceptTerms = true
        }));
        var code = trial.GetProperty("companyCode").GetString()!;

        // Before registration the company cannot sign in, and its code looks like any unknown code (no probing).
        var before = await Json(await host.SendAsync(HttpMethod.Get, $"/api/public/business-profile?companyCode={code}", null));
        Assert.Equal("", before.GetProperty("businessName").GetString());

        var registered = await host.SendAsync(HttpMethod.Post, "/api/auth/register", null, new
        {
            companyCode = code, registrationCode = trial.GetProperty("registrationCode").GetString(), fullName = "Gokul", username = "gokul",
            password = PlatformTestEnvironment.OwnerPassword, confirmPassword = PlatformTestEnvironment.OwnerPassword
        });
        Assert.Equal(HttpStatusCode.Created, registered.StatusCode);

        // Company Settings start with the sign-up details; the Owner completes the address and PIN code.
        var companyId = await host.InScopeAsync(sp => sp.GetRequiredService<PlatformDbContext>().Companies
            .Where(c => c.Code == code).Select(c => c.Id).SingleAsync());
        var profile = await host.InScopeAsync(async sp =>
        {
            sp.GetRequiredService<CarSpaManagement.Api.Infrastructure.Tenancy.TenantContext>().Set(companyId);
            return await sp.GetRequiredService<AppDbContext>().BusinessProfiles.AsNoTracking().SingleAsync();
        });
        Assert.Equal("Gokul Detailing", profile.BusinessName);
        Assert.Equal("Erode", profile.City);
        Assert.Equal("Tamil Nadu", profile.State);
        Assert.Equal(mobile, profile.Phone);
        Assert.Equal(email, profile.Email);

        var after = await Json(await host.SendAsync(HttpMethod.Get, $"/api/public/business-profile?companyCode={code}", null));
        Assert.Equal("Gokul Detailing", after.GetProperty("businessName").GetString());
    }
}
