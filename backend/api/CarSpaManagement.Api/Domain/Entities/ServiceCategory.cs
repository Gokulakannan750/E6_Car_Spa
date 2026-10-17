using CarSpaManagement.Api.Domain.Common;

namespace CarSpaManagement.Api.Domain.Entities;

public class ServiceCategory : BaseEntity, IOrganizationOwned
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
}
