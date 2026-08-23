using CarSpaManagement.Api.Domain.Common;

namespace CarSpaManagement.Api.Domain.Entities;

public class UserPermission : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public Guid PermissionId { get; set; }
    public Permission Permission { get; set; } = null!;
}
