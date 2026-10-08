namespace CarSpaManagement.Api.Application.DTOs.Settings;

/// <summary>
/// Minimal public business branding DTO safe for unauthenticated login screens and public pages.
/// Contains strictly non-sensitive display branding: business name, logo URL/path, version timestamp, and the company's UI colours (needed to theme the login page).
/// </summary>
public record PublicBusinessProfileDto(
    string BusinessName,
    string? LogoPath,
    DateTime? UpdatedAt,
    string? AppColor = null,
    string? SidebarColor = null
);
