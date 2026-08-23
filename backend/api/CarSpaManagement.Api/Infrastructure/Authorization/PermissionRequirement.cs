using Microsoft.AspNetCore.Authorization;

namespace CarSpaManagement.Api.Infrastructure.Authorization;

public class PermissionRequirement(string permission) : IAuthorizationRequirement
{
    public string Permission { get; } = permission;
}
