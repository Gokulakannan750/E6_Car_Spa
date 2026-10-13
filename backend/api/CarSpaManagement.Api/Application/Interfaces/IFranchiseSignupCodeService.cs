using CarSpaManagement.Api.Application.DTOs.Franchise;

namespace CarSpaManagement.Api.Application.Interfaces;

/// <summary>
/// The franchisor's franchise sign-up codes: a short-lived, single-use code a new franchisee enters on Trovo's
/// sign-up website, so its new company is linked to the franchisor as soon as it is created (with the franchisee's
/// consent, given on the website). Only on Trovo's platform.
/// </summary>
public interface IFranchiseSignupCodeService
{
    Task<FranchiseSignupCodesDto> ListAsync(CancellationToken cancellationToken = default);
    Task<CreatedFranchiseSignupCodeDto> CreateAsync(CreateFranchiseSignupCodeRequest request, CancellationToken cancellationToken = default);
    Task<FranchiseSignupCodeDto> CancelAsync(Guid id, CancellationToken cancellationToken = default);
}
