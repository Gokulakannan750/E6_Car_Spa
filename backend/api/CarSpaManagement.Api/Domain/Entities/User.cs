using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Enums;

namespace CarSpaManagement.Api.Domain.Entities;

public class User : BaseEntity, IOrganizationOwned
{
    /// <summary>The company this row belongs to. Stamped automatically on save; never changes.</summary>
    public Guid OrganizationId { get; set; }

    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? LastLoginAt { get; set; }

    /// <summary>Which apps this user may sign in to (each needs a licence of that type on Trovo's platform).</summary>
    public AppAccess AppAccess { get; set; } = AppAccess.Both;

    public ICollection<UserPermission> UserPermissions { get; set; } = new List<UserPermission>();
}
