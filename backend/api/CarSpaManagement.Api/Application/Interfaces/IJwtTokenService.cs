using CarSpaManagement.Api.Domain.Entities;

namespace CarSpaManagement.Api.Application.Interfaces;

public interface IJwtTokenService
{
    /// <param name="app">The app signing in ("windows"/"android"), kept in the token so every request can be checked against the user's licence.</param>
    string GenerateToken(User user, string? app = null);
}
