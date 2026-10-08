namespace CarSpaManagement.Api.Infrastructure.Tenancy;

/// <summary>Which company the current work is for. Set from the verified sign-in token, never from client input.</summary>
public interface ITenantContext
{
    /// <summary>The current company, or null when none has been established (then no company data is visible).</summary>
    Guid? OrganizationId { get; }
}

/// <summary>The per-request tenant context. Set once per request by the authentication step.</summary>
public sealed class TenantContext : ITenantContext
{
    public Guid? OrganizationId { get; private set; }

    /// <summary>Establishes the company for this scope. It can be set only once, so a request cannot switch company.</summary>
    public void Set(Guid organizationId)
    {
        if (organizationId == Guid.Empty)
            throw new ArgumentException("An organization id is required.", nameof(organizationId));

        if (OrganizationId is { } existing && existing != organizationId)
            throw new TenantViolationException("The company for this request has already been set and cannot be changed.");

        OrganizationId = organizationId;
    }
}

/// <summary>A fixed company, for background work, seeding and tests that run for one known company.</summary>
public sealed class FixedTenantContext(Guid organizationId) : ITenantContext
{
    public Guid? OrganizationId { get; } = organizationId;
}

/// <summary>No company at all: every company-owned query returns nothing and saving company data is refused.</summary>
public sealed class NoTenantContext : ITenantContext
{
    public static readonly NoTenantContext Instance = new();

    public Guid? OrganizationId => null;
}

/// <summary>Thrown when code tries to read or write across company boundaries.</summary>
public sealed class TenantViolationException(string message) : InvalidOperationException(message);

/// <summary>
/// The one company that existing (pre multi-company) data belongs to. The upgrade migration assigns all current
/// rows to this organization, and code that has no explicit company (older tests, single-company tools) uses it.
/// </summary>
public static class DefaultOrganization
{
    public static readonly Guid Id = new("0f3c7a52-6b1e-4d8a-9c25-5e1d2a7b9001");
    public const string Code = "0001";
}
