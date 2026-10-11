using CarSpaManagement.Api.Domain.Common;
using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Domain.Entities;

public class SystemPreference : BaseEntity, IOrganizationOwned
{
    /// <summary>The company this row belongs to. Stamped automatically on save; never changes.</summary>
    public Guid OrganizationId { get; set; }

    /// <summary>
    /// Database singleton key ensuring only ONE active system preferences record exists in the system.
    /// </summary>
    public int SingletonKey { get; set; } = 1;

    [Required]
    [MaxLength(20)]
    public string DateFormat { get; set; } = "DD/MM/YYYY";

    [Required]
    [MaxLength(10)]
    public string TimeFormat { get; set; } = "12h";

    [Required]
    [MaxLength(10)]
    public string CurrencySymbol { get; set; } = "₹";

    public int DecimalPrecision { get; set; } = 2;

    public int DefaultPrintCopies { get; set; } = 1;

    public bool AutoPrintReceipt { get; set; } = true;

    public int RefreshInterval { get; set; } = 30;
}
