using System.Security.Claims;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class StaleJwtOwnerDefenseTests
{
    private static (ServiceProvider provider, AppDbContext db, IAuthorizationService authService) CreateAuthorizationPipelineEnvironment()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName)
                   .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

        // Register standard ASP.NET Core authorization services + custom permission provider & handler
        services.AddLogging();
        services.AddAuthorization();
        services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
        services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

        var provider = services.BuildServiceProvider();
        var db = provider.GetRequiredService<AppDbContext>();
        var authService = provider.GetRequiredService<IAuthorizationService>();

        return (provider, db, authService);
    }

    private static ClaimsPrincipal CreateStaleOwnerJwtPrincipal(Guid userId)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new("sub", userId.ToString()),
            new(ClaimTypes.Role, "Owner"),
            new("role", "Owner"),
            new("isOwner", "true")
        };

        var identity = new ClaimsIdentity(claims, "Bearer");
        return new ClaimsPrincipal(identity);
    }

    [Fact]
    public async Task StaleJwt_WithStaffInDatabaseAndOwnerClaimsInJwt_IsDeniedByAuthorizationPipeline()
    {
        // ARRANGE: Full ASP.NET Core Authorization Pipeline
        var (provider, db, authService) = CreateAuthorizationPipelineEnvironment();

        // 1. User is registered in database as Staff (e.g. demoted or never was Owner)
        var staffUser = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Demoted Staff",
            Username = "staff1",
            Role = UserRole.Staff, // DATABASE SAYS STAFF
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(staffUser);
        await db.SaveChangesAsync();

        // 2. Client presents a JWT that claims role=Owner and isOwner=true
        var stalePrincipal = CreateStaleOwnerJwtPrincipal(staffUser.Id);

        // 3. User does NOT have "settings.business" permission in database
        var policyName = $"{RequirePermissionAttribute.PolicyPrefix}settings.business";

        // ACT: Execute the full authorization pipeline via IAuthorizationService
        var authResult = await authService.AuthorizeAsync(stalePrincipal, null, policyName);

        // ASSERT: Authorization MUST BE DENIED because database role is Staff and permission is absent
        Assert.False(authResult.Succeeded, "A Staff user holding stale Owner JWT claims must not bypass authorization.");
    }

    [Fact]
    public async Task GenuineOwner_WithDatabaseOwnerRole_IsGrantedAccessByAuthorizationPipeline()
    {
        // ARRANGE
        var (provider, db, authService) = CreateAuthorizationPipelineEnvironment();

        // 1. User is legitimately an Owner in the database
        var ownerUser = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Genuine Owner",
            Username = "owner1",
            Role = UserRole.Owner, // DATABASE SAYS OWNER
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(ownerUser);
        await db.SaveChangesAsync();

        var ownerPrincipal = CreateStaleOwnerJwtPrincipal(ownerUser.Id);
        var policyName = $"{RequirePermissionAttribute.PolicyPrefix}settings.business";

        // ACT
        var authResult = await authService.AuthorizeAsync(ownerPrincipal, null, policyName);

        // ASSERT: Genuine Owner succeeds
        Assert.True(authResult.Succeeded, "Active Owner in database must succeed authorization.");
    }
}
