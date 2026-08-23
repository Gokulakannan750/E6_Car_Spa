using Microsoft.AspNetCore.Authorization;

namespace CarSpaManagement.Api.Infrastructure.Authorization;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true, Inherited = true)]
public class RequirePermissionAttribute : AuthorizeAttribute
{
    public const string PolicyPrefix = "Permission:";

    public RequirePermissionAttribute(string permission)
        : base(policy: $"{PolicyPrefix}{permission}")
    {
    }
}
