using System.ComponentModel.DataAnnotations;

namespace CarSpaManagement.Api.Application.DTOs;

public class AuthStatusDto
{
    public bool Initialized { get; set; }

    /// <summary>
    /// True on Trovo's platform: a new company is registered with the company code and one-time registration code
    /// Trovo gave the customer (POST /api/auth/register), not with first-time setup.
    /// </summary>
    public bool CompanyRegistration { get; set; }
}

/// <summary>First registration of a company Trovo has created: the codes Trovo gave the customer, plus the Owner account.</summary>
public class RegisterCompanyRequest : BootstrapOwnerRequest
{
    [Required]
    [StringLength(20)]
    public string CompanyCode { get; set; } = string.Empty;

    [Required]
    [StringLength(30)]
    public string RegistrationCode { get; set; } = string.Empty;
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
    /// The company's code (for example "0001"). Optional only while the server has a single company; once there
    /// are several, the code is how sign-in knows which company's users to check.
    /// </summary>
    [StringLength(20)]
    public string? CompanyCode { get; set; }

    /// <summary>
    /// Which app is signing in: "windows" or "android". On Trovo's platform a user may only sign in to the apps
    /// their licence covers; an app that does not say is treated as needing both.
    /// </summary>
    [StringLength(20)]
    public string? App { get; set; }
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

    /// <summary>"Both", "Android" or "Windows".</summary>
    public string AppAccess { get; set; } = "Both";
}

/// <summary>The new Owner plus the code of the company that was just created, which they sign in with.</summary>
public class BootstrapOwnerResponse : AuthUserDto
{
    public string CompanyCode { get; set; } = string.Empty;
}

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public AuthUserDto User { get; set; } = null!;

    /// <summary>The company the user signed in to, so the apps can remember the code.</summary>
    public string CompanyCode { get; set; } = string.Empty;
}
