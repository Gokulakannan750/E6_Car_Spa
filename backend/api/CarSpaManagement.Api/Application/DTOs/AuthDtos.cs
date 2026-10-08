using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs;

public class AuthStatusDto
{
    public bool Initialized { get; set; }
}

public class BootstrapOwnerRequest
{
    [Required]
    [StringLength(150)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string Username { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    [Required]
    public string ConfirmPassword { get; set; } = string.Empty;
}

public class LoginRequest
{
    [Required]
    public string Username { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// The company's code (for example "01-0001"). Optional only while the server has a single company; once there
    /// are several, the code is how sign-in knows which company's users to check.
    /// </summary>
    [StringLength(20)]
    public string? CompanyCode { get; set; }
}

public class AuthUserDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Role { get; set; } = string.Empty;
    public bool IsOwner { get; set; }
    public List<string> Permissions { get; set; } = [];
}

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public AuthUserDto User { get; set; } = null!;

    /// <summary>The company the user signed in to, so the apps can remember the code.</summary>
    public string CompanyCode { get; set; } = string.Empty;
}
