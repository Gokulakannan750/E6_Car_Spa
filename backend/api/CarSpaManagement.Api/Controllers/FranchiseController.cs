using CarSpaManagement.Api.Application.DTOs.Franchise;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

/// <summary>The franchise network: links between this company and the companies it franchises, or that franchise it.</summary>
[ApiController]
[Route("api/franchise")]
public class FranchiseController(IFranchiseService franchiseService) : ControllerBase
{
    [HttpGet]
    [RequirePermission("franchise.view")]
    public async Task<IActionResult> GetNetwork(CancellationToken ct) =>
        Ok(await franchiseService.GetNetworkAsync(ct));

    [HttpPost("invites")]
    [RequirePermission("franchise.manage")]
    public async Task<IActionResult> SendInvite([FromBody] SendFranchiseInviteRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        return Ok(await franchiseService.SendInviteAsync(request, ct));
    }

    [HttpPost("links/{id:guid}/cancel")]
    [RequirePermission("franchise.manage")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct) =>
        Ok(await franchiseService.CancelInviteAsync(id, ct));

    [HttpPost("links/{id:guid}/respond")]
    [RequirePermission("franchise.manage")]
    public async Task<IActionResult> Respond(Guid id, [FromBody] RespondToFranchiseInviteRequest request, CancellationToken ct) =>
        Ok(await franchiseService.RespondAsync(id, request, ct));

    [HttpPost("links/{id:guid}/end")]
    [RequirePermission("franchise.manage")]
    public async Task<IActionResult> End(Guid id, CancellationToken ct) =>
        Ok(await franchiseService.EndLinkAsync(id, ct));

    [HttpPost("links/{id:guid}/scopes")]
    [RequirePermission("franchise.manage")]
    public async Task<IActionResult> RequestScopes(Guid id, [FromBody] RequestFranchiseScopesRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        return Ok(await franchiseService.RequestScopesAsync(id, request, ct));
    }

    [HttpPut("links/{id:guid}/scopes/{scope}")]
    [RequirePermission("franchise.manage")]
    public async Task<IActionResult> DecideScope(Guid id, string scope, [FromBody] DecideFranchiseScopeRequest request, CancellationToken ct) =>
        Ok(await franchiseService.DecideScopeAsync(id, scope, request, ct));
}
