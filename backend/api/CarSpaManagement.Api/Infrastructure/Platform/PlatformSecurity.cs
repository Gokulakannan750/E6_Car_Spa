using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using CarSpaManagement.Api.Domain.Platform;
using Microsoft.IdentityModel.Tokens;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>
/// Sign-in tokens for Trovo's platform administrators. A separate key, issuer and audience from company sign-ins,
/// so a company user's token can never reach the platform API and a platform token can never reach a company.
/// </summary>
public sealed class PlatformTokenService(IConfiguration configuration)
{
    public const string Scheme = "Platform";
    public const string Issuer = "TrovoPlatform";
    public const string AccessAudience = "TrovoPlatformAdmin";
    public const string ChallengeAudience = "TrovoPlatformChallenge";

    public static readonly TimeSpan AccessLifetime = TimeSpan.FromHours(2);
    public static readonly TimeSpan ChallengeLifetime = TimeSpan.FromMinutes(5);

    /// <summary>The platform signing key ("Platform:Jwt:Key" in server secrets, at least 32 characters).</summary>
    public static SymmetricSecurityKey SigningKey(IConfiguration configuration)
    {
        var key = configuration["Platform:Jwt:Key"];
        if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
        {
            throw new InvalidOperationException("Platform:Jwt:Key (at least 32 characters) is required when the platform is enabled.");
        }
        if (string.Equals(key, configuration["Jwt:Key"], StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Platform:Jwt:Key must differ from the company sign-in key (Jwt:Key).");
        }
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
    }

    public static TokenValidationParameters AccessValidation(IConfiguration configuration) => new()
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = SigningKey(configuration),
        ValidateIssuer = true,
        ValidIssuer = Issuer,
        ValidateAudience = true,
        ValidAudience = AccessAudience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero,
        RoleClaimType = ClaimTypes.Role,
        NameClaimType = ClaimTypes.Email
    };

    public string CreateAccessToken(PlatformAdmin admin) => Create(AccessAudience, AccessLifetime,
    [
        new Claim(JwtRegisteredClaimNames.Sub, admin.Id.ToString()),
        new Claim(ClaimTypes.NameIdentifier, admin.Id.ToString()),
        new Claim(ClaimTypes.Email, admin.Email),
        new Claim(ClaimTypes.Name, admin.Name),
        new Claim(ClaimTypes.Role, admin.Role.ToString())
    ]);

    /// <summary>A short-lived token between the password step and the authenticator-code step. Not an access token.</summary>
    public string CreateChallengeToken(Guid adminId) => Create(ChallengeAudience, ChallengeLifetime,
        [new Claim(JwtRegisteredClaimNames.Sub, adminId.ToString())]);

    /// <summary>The administrator a valid challenge token belongs to, or null.</summary>
    public Guid? ReadChallengeToken(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        try
        {
            var parameters = AccessValidation(configuration);
            parameters.ValidAudience = ChallengeAudience;
            var principal = new JwtSecurityTokenHandler { MapInboundClaims = false }.ValidateToken(token, parameters, out _);
            return Guid.TryParse(principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id) ? id : null;
        }
        catch (SecurityTokenException)
        {
            return null;
        }
        catch (ArgumentException)
        {
            return null;
        }
    }

    private string Create(string audience, TimeSpan lifetime, IEnumerable<Claim> claims)
    {
        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.Add(lifetime),
            signingCredentials: new SigningCredentials(SigningKey(configuration), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

/// <summary>The platform roles and the policies that require them.</summary>
public static class PlatformPolicies
{
    public const string Any = "Platform.Any";
    public const string Support = "Platform.Support";
    public const string Billing = "Platform.Billing";
    public const string Owner = "Platform.Owner";
}

/// <summary>Writes the append-only platform audit log: who did what to which company, before and after, and why.</summary>
public sealed class PlatformAuditService(PlatformDbContext catalog, IHttpContextAccessor http)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task RecordAsync(string action, Guid? companyId, object? before, object? after, string? reason,
        CancellationToken cancellationToken = default)
    {
        var context = http.HttpContext;
        var user = context?.User;
        catalog.AuditLogs.Add(new PlatformAuditLog
        {
            Id = Guid.NewGuid(),
            AdministratorId = Guid.TryParse(user?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null,
            AdministratorEmail = user?.FindFirstValue(ClaimTypes.Email),
            Action = action,
            TargetCompanyId = companyId,
            BeforeValues = before is null ? null : JsonSerializer.Serialize(before, Json),
            AfterValues = after is null ? null : JsonSerializer.Serialize(after, Json),
            Reason = reason is { Length: > 500 } ? reason[..500] : reason,
            CorrelationId = context?.TraceIdentifier,
            IpAddress = context?.Connection.RemoteIpAddress?.ToString(),
            CreatedAt = DateTime.UtcNow
        });
        await catalog.SaveChangesAsync(cancellationToken);
    }
}
