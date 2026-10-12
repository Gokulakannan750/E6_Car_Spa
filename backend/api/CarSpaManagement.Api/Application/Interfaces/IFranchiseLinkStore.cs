using CarSpaManagement.Api.Domain.Entities;

namespace CarSpaManagement.Api.Application.Interfaces;

/// <summary>A company as the franchise screens know it.</summary>
public sealed record FranchisePartner(Guid Id, string Code, string Name);

/// <summary>
/// Where franchise links are kept. On a single-company server they are in the company database (protected by its
/// row rules); on Trovo's platform, where every company has its own database, they are in Trovo's catalog.
/// Either way <see cref="Links"/> only ever returns links the signed-in company is a party to.
/// </summary>
public interface IFranchiseLinkStore
{
    /// <summary>True when the links live in the company database (single-company server).</summary>
    bool InCompanyDatabase { get; }

    /// <summary>The links the signed-in company is a party to (as franchisor or franchisee).</summary>
    IQueryable<FranchiseLink> Links { get; }

    void Add(FranchiseLink link);
    void AddScope(FranchiseLinkScope scope);
    Task SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>The active company with this sign-in code, or null.</summary>
    Task<FranchisePartner?> FindActiveCompanyByCodeAsync(string code, CancellationToken cancellationToken = default);

    /// <summary>Names and codes of the given companies (for showing who a link is with).</summary>
    Task<IReadOnlyDictionary<Guid, FranchisePartner>> GetCompaniesAsync(IEnumerable<Guid> ids, CancellationToken cancellationToken = default);
}
