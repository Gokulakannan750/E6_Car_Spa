namespace CarSpaManagement.Api.Domain.Common;

/// <summary>
/// Marks a table whose rows belong to exactly one company (organization). The database context filters every
/// query to the current company and stamps this value on every new row, so a company can never read or change
/// another company's data.
/// </summary>
public interface IOrganizationOwned
{
    Guid OrganizationId { get; set; }
}
