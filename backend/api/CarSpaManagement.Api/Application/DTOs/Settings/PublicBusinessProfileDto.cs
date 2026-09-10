namespace CarSpaManagement.Api.Application.DTOs.Settings;

/// <summary>
/// Minimal public business branding DTO safe for unauthenticated login screens and public pages.
/// Contains strictly non-sensitive display branding: business name, logo URL/path, and version timestamp.
/// </summary>
public record PublicBusinessProfileDto(
    string BusinessName,
    string? LogoPath,
    DateTime? UpdatedAt
);
