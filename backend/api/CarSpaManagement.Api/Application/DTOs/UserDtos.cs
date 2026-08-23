using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs;

public class UserDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<string> Permissions { get; set; } = [];
}

public class CreateUserRequest
{
    [Required]
    [StringLength(150)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string Username { get; set; } = string.Empty;

    [StringLength(150)]
    [EmailAddress]
    public string? Email { get; set; }

    [Required]
    public string Password { get; set; } = string.Empty;

    [Required]
    public string ConfirmPassword { get; set; } = string.Empty;

    [Required]
    public string Role { get; set; } = string.Empty; // "Manager" or "Staff"

    public List<string> PermissionCodes { get; set; } = [];
}

public class UpdateUserRequest
{
    [Required]
    [StringLength(150)]
    public string FullName { get; set; } = string.Empty;

    [StringLength(150)]
    [EmailAddress]
    public string? Email { get; set; }

    public string? Password { get; set; }
    public string? ConfirmPassword { get; set; }

    public string? Role { get; set; } // "Manager" or "Staff"

    public List<string>? PermissionCodes { get; set; }
}

public class PermissionDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class PermissionGroupDto
{
    public string Module { get; set; } = string.Empty;
    public List<PermissionDto> Permissions { get; set; } = [];
}
