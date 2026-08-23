using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace CarSpaManagement.Api.Application.Services;

public class JwtTokenService(IConfiguration configuration) : IJwtTokenService
{
    public string GenerateToken(User user)
    {
        var secretKey = configuration["Jwt:Key"] ?? "E6CarSpa_SuperSecure_SecretSigningKey_2026_Auth_Foundation_Key";
        var issuer = configuration["Jwt:Issuer"] ?? "E6CarSpa";
        var audience = configuration["Jwt:Audience"] ?? "E6CarSpaDesktop";
        var expMinutesStr = configuration["Jwt:ExpirationMinutes"];
        var expMinutes = int.TryParse(expMinutesStr, out var exp) ? exp : 1440;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.FullName),
            new(JwtRegisteredClaimNames.UniqueName, user.Username),
            new(ClaimTypes.Role, user.Role.ToString()),
            new("isOwner", (user.Role == UserRole.Owner).ToString().ToLowerInvariant())
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(expMinutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
