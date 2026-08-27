using System.Security.Claims;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Infrastructure.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CarSpaManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController(IUserService userService) : ControllerBase
{
    private (Guid UserId, bool IsOwner) GetCallerInfo()
    {
        var currentUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        Guid.TryParse(currentUserIdStr, out var currentUserId);
        var isOwner = User.IsInRole("Owner") || string.Equals(User.FindFirstValue("isOwner"), "true", StringComparison.OrdinalIgnoreCase);
        return (currentUserId, isOwner);
    }

    [HttpGet]
    [RequirePermission("users.view")]
    public async Task<ActionResult<List<UserDto>>> GetUsers(CancellationToken cancellationToken)
    {
        var users = await userService.GetUsersAsync(cancellationToken);
        return Ok(users);
    }

    [HttpGet("permissions")]
    [RequirePermission("users.view")]
    public async Task<ActionResult<List<PermissionGroupDto>>> GetPermissions(CancellationToken cancellationToken)
    {
        var permissions = await userService.GetAvailablePermissionsAsync(cancellationToken);
        return Ok(permissions);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("users.view")]
    public async Task<ActionResult<UserDto>> GetUserById(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var user = await userService.GetUserByIdAsync(id, cancellationToken);
            return Ok(user);
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPost]
    [RequirePermission("users.create")]
    public async Task<ActionResult<UserDto>> CreateUser([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        var (currentUserId, isOwner) = GetCallerInfo();

        try
        {
            var user = await userService.CreateUserAsync(request, currentUserId, isOwner, cancellationToken);
            return CreatedAtAction(nameof(GetUserById), new { id = user.Id }, user);
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message });
        }
        catch (ConflictException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("users.edit")]
    public async Task<ActionResult<UserDto>> UpdateUser(Guid id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        var (currentUserId, isOwner) = GetCallerInfo();

        try
        {
            var user = await userService.UpdateUserAsync(id, request, currentUserId, isOwner, cancellationToken);
            return Ok(user);
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPatch("{id:guid}/toggle-status")]
    [RequirePermission("users.deactivate")]
    public async Task<ActionResult<UserDto>> ToggleUserStatus(Guid id, CancellationToken cancellationToken)
    {
        var (currentUserId, _) = GetCallerInfo();

        try
        {
            var user = await userService.ToggleUserStatusAsync(id, currentUserId, cancellationToken);
            return Ok(user);
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
