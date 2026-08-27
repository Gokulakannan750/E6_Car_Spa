using System.Security.Claims;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Infrastructure.Authorization;

public class PermissionAuthorizationHandler(IServiceScopeFactory scopeFactory)
    : AuthorizationHandler<PermissionRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (context.User.Identity is not { IsAuthenticated: true })
        {
            return;
        }

        var userIdStr = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? context.User.FindFirstValue("sub");

        if (!Guid.TryParse(userIdStr, out var userId))
        {
            return;
        }

        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null || !user.IsActive)
        {
            return; // Inactive or deleted user denied immediately
        }

        // 1. OWNER RULE: Active Owner bypasses all permission checks automatically
        if (user.Role == UserRole.Owner ||
            context.User.IsInRole("Owner") ||
            context.User.HasClaim(c => c.Type == "isOwner" && c.Value.Equals("true", StringComparison.OrdinalIgnoreCase)))
        {
            context.Succeed(requirement);
            return;
        }

        // 2. Manager / Staff: check if assigned permission exists in database
        var hasPermission = await db.UserPermissions
            .AsNoTracking()
            .AnyAsync(up => up.UserId == userId && up.Permission.Code == requirement.Permission);

        if (hasPermission)
        {
            context.Succeed(requirement);
        }
    }
}
