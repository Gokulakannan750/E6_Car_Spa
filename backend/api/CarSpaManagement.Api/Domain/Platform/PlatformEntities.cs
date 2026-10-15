using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Domain.Platform;

// Trovo's own catalog ("carspa_platform"). It knows which companies exist, which product they use and where each
// company's database is. It never holds a company's business data: that lives only in the company's own database.

/// <summary>One of Trovo's software products, for example the car spa software. Companies and plans belong to a product.</summary>
public class PlatformProduct
{
    public Guid Id { get; set; }

    /// <summary>Short fixed key used in configuration and database names, for example "carspa".</summary>
    [Required, MaxLength(30)]
    public string Key { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    [Required, MaxLength(50)]
    public string TrialPlanCode { get; set; } = "professional";

    [Required, MaxLength(30)]
    public string DatabasePrefix { get; set; } = string.Empty;

    public SeatModel SeatModel { get; set; }

    [MaxLength(500)]
    public string Capabilities { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}

public enum PlatformCompanyStatus
{
    /// <summary>Database created; waiting for the customer to register with the registration code.</summary>
    AwaitingRegistration = 0,

    /// <summary>Registered and in use.</summary>
    Active = 1,

    /// <summary>Switched off by Trovo. Nobody can sign in.</summary>
    Suspended = 2
}

/// <summary>A customer company and the location of its own database.</summary>
public class PlatformCompany
{
    /// <summary>Also the company's id inside its own database (Organizations.Id), so sign-in tokens identify it.</summary>
    public Guid Id { get; set; }

    public Guid ProductId { get; set; }
    public PlatformProduct? Product { get; set; }

    /// <summary>The code people type at sign-in, for example "0002". Unique within the product.</summary>
    [Required, MaxLength(20)]
    public string Code { get; set; } = string.Empty;

    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    public PlatformCompanyStatus Status { get; set; }

    /// <summary>The company's own database, for example "carspa_t_0002".</summary>
    [Required, MaxLength(63)]
    public string DatabaseName { get; set; } = string.Empty;

    /// <summary>The database login that only this company's database accepts.</summary>
    [Required, MaxLength(63)]
    public string DatabaseUser { get; set; } = string.Empty;

    /// <summary>The login's password, encrypted with the server key. Never returned by any API or written to logs.</summary>
    [Required, MaxLength(500)]
    public string DatabasePasswordEncrypted { get; set; } = string.Empty;

    /// <summary>The last migration applied to the company's database, or null before the first migration.</summary>
    [MaxLength(150)]
    public string? SchemaVersion { get; set; }

    public DateTime? LastMigratedAt { get; set; }

    /// <summary>Why the last migration failed. While set, sign-in to this company is paused.</summary>
    [MaxLength(1000)]
    public string? MigrationError { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? RegisteredAt { get; set; }
}

/// <summary>
/// The one-time code Trovo gives a customer for registering their company the first time. Only a hash is stored;
/// the code itself is shown once, when it is issued.
/// </summary>
public class PlatformRegistrationCode
{
    public Guid Id { get; set; }

    public Guid CompanyId { get; set; }
    public PlatformCompany? Company { get; set; }

    [Required, MaxLength(128)]
    public string CodeHash { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }

    /// <summary>When the code was used. A used code can never be used again.</summary>
    public DateTime? UsedAt { get; set; }

    /// <summary>When Trovo replaced it with a new code.</summary>
    public DateTime? RevokedAt { get; set; }

    /// <summary>Wrong attempts against this company's code; too many locks the code until a new one is issued.</summary>
    public int FailedAttempts { get; set; }
}
