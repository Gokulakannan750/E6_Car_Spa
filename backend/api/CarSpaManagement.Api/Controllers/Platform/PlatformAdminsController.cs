using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Platform;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers.Platform;

public sealed record PlatformAdminListItem(Guid Id, string Email, string Name, string Role, bool IsActive, bool TotpConfirmed,
    bool MustChangePassword, DateTime? LastSignInAt, DateTime CreatedAt);
public sealed record CreatePlatformAdminRequest(string Email, string Name, string Role);
public sealed record CreatePlatformAdminResponse(PlatformAdminListItem Admin, string OneTimePassword);
public sealed record UpdatePlatformAdminRequest(string? Role, bool? IsActive, string Reason);
public sealed record ResetPlatformAdminRequest(string Reason);
public sealed record ResetPlatformAdminResponse(string OneTimePassword);

/// <summary>Trovo's own staff accounts (Owner only). One-time passwords are shown once; every change is audited.</summary>
[ApiController]
[Route("api/platform/admins")]
[Authorize(Policy = PlatformPolicies.Owner)]
public class PlatformAdminsController(PlatformAdminService admins, PlatformAuditService audit) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PlatformAdminListItem>>> List(CancellationToken cancellationToken) =>
        Ok((await admins.ListAsync(cancellationToken)).Select(ToDto).ToList());

    [HttpPost]
    public async Task<ActionResult<CreatePlatformAdminResponse>> Create([FromBody] CreatePlatformAdminRequest request, CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<PlatformAdminRole>(request.Role, ignoreCase: true, out var role))
        {
            return BadRequest(new { error = "Role must be Owner, Billing, Support or ReadOnly." });
        }
        try
        {
            var (admin, password) = await admins.CreateAsync(request.Email, request.Name, role, cancellationToken);
            await audit.RecordAsync("admin.created", null, null, new { admin.Email, role = admin.Role.ToString() }, null, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, new CreatePlatformAdminResponse(ToDto(admin), password));
        }
        catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
        catch (ConflictException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PlatformAdminListItem>> Update(Guid id, [FromBody] UpdatePlatformAdminRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { error = "A reason is required." });
        PlatformAdminRole? role = null;
        if (request.Role is not null)
        {
            if (!Enum.TryParse<PlatformAdminRole>(request.Role, ignoreCase: true, out var parsed))
            {
                return BadRequest(new { error = "Role must be Owner, Billing, Support or ReadOnly." });
            }
            role = parsed;
        }

        try
        {
            var before = (await admins.ListAsync(cancellationToken)).FirstOrDefault(a => a.Id == id);
            var admin = await admins.UpdateAsync(id, role, request.IsActive, CurrentAdminId(), cancellationToken);
            await audit.RecordAsync("admin.updated", null,
                before is null ? null : new { before.Email, role = before.Role.ToString(), before.IsActive },
                new { admin.Email, role = admin.Role.ToString(), admin.IsActive }, request.Reason, cancellationToken);
            return Ok(ToDto(admin));
        }
        catch (ValidationException ex) { return BadRequest(new { error = ex.Message }); }
        catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }

    /// <summary>New one-time password and 2-step verification set up again (e.g. a lost phone).</summary>
    [HttpPost("{id:guid}/reset")]
    public async Task<ActionResult<ResetPlatformAdminResponse>> Reset(Guid id, [FromBody] ResetPlatformAdminRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { error = "A reason is required." });
        if (id == CurrentAdminId()) return BadRequest(new { error = "Use My account to change your own password." });
        try
        {
            var password = await admins.ResetAsync(id, cancellationToken);
            await audit.RecordAsync("admin.reset", null, null, new { adminId = id }, request.Reason, cancellationToken);
            return Ok(new ResetPlatformAdminResponse(password));
        }
        catch (NotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }

    private Guid CurrentAdminId() => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private static PlatformAdminListItem ToDto(PlatformAdmin a) =>
        new(a.Id, a.Email, a.Name, a.Role.ToString(), a.IsActive, a.TotpConfirmed, a.MustChangePassword, a.LastSignInAt, a.CreatedAt);
}
