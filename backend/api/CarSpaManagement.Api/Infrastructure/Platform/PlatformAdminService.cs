using System.Security.Cryptography;
using System.Text;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Platform;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>The outcome of the first sign-in step (email and password).</summary>
public sealed record PlatformSignInStep(PlatformAdmin Admin, bool NeedsTotpSetup, string? TotpSecret);

/// <summary>
/// Trovo's platform administrators: accounts, passwords and the required 2-step verification (an authenticator app
/// code, RFC 6238). Completely separate from every company's users.
/// </summary>
public sealed class PlatformAdminService(PlatformDbContext catalog, IAesEncryptionService encryption)
{
    private const int MaxFailedAttempts = 5;

    /// <summary>Platform admins can change every company's subscription, so their passwords are longer than the apps' minimum.</summary>
    public const int MinimumAdminPasswordLength = 12;
    private static readonly TimeSpan LockoutFor = TimeSpan.FromMinutes(15);
    private const string Issuer = "Trovo Platform";

    private readonly PasswordHasher<PlatformAdmin> _hasher = new();

    /// <summary>Creates an administrator with a generated password, returned once so it can be handed over.</summary>
    public async Task<(PlatformAdmin Admin, string Password)> CreateAsync(string email, string name, PlatformAdminRole role,
        CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeEmail(email);
        if (string.IsNullOrWhiteSpace(name)) throw new ValidationException("A name is required.");
        if (await catalog.Admins.AnyAsync(a => a.Email == normalized, cancellationToken))
        {
            throw new ConflictException("An administrator with this email already exists.");
        }

        var password = GeneratePassword();
        var admin = new PlatformAdmin
        {
            Id = Guid.NewGuid(),
            Email = normalized,
            Name = name.Trim(),
            Role = role,
            IsActive = true,
            MustChangePassword = true,
            CreatedAt = DateTime.UtcNow
        };
        admin.PasswordHash = _hasher.HashPassword(admin, password);
        catalog.Admins.Add(admin);
        await catalog.SaveChangesAsync(cancellationToken);
        return (admin, password);
    }

    /// <summary>Sets a new generated password and clears 2-step verification, so the admin sets it up again.</summary>
    public async Task<string> ResetAsync(string email, CancellationToken cancellationToken = default)
    {
        var admin = await catalog.Admins.FirstOrDefaultAsync(a => a.Email == NormalizeEmail(email), cancellationToken)
            ?? throw new NotFoundException("No administrator with this email.");
        return await ResetAsync(admin, cancellationToken);
    }

    /// <summary>Same as <see cref="ResetAsync(string, CancellationToken)"/>, by id (from the admin portal).</summary>
    public async Task<string> ResetAsync(Guid adminId, CancellationToken cancellationToken = default)
    {
        var admin = await catalog.Admins.FirstOrDefaultAsync(a => a.Id == adminId, cancellationToken)
            ?? throw new NotFoundException("Administrator not found.");
        return await ResetAsync(admin, cancellationToken);
    }

    private async Task<string> ResetAsync(PlatformAdmin admin, CancellationToken cancellationToken)
    {
        var password = GeneratePassword();
        admin.PasswordHash = _hasher.HashPassword(admin, password);
        admin.TotpSecretEncrypted = null;
        admin.TotpConfirmed = false;
        admin.MustChangePassword = true;
        admin.FailedSignInAttempts = 0;
        admin.LockedUntil = null;
        await catalog.SaveChangesAsync(cancellationToken);
        return password;
    }

    public async Task<IReadOnlyList<PlatformAdmin>> ListAsync(CancellationToken cancellationToken = default) =>
        await catalog.Admins.AsNoTracking().OrderBy(a => a.Name).ToListAsync(cancellationToken);

    /// <summary>
    /// Changes an admin's role or switches the account off/on. Nobody can switch themselves off or lower their own
    /// role, and the platform always keeps at least one active Owner.
    /// </summary>
    public async Task<PlatformAdmin> UpdateAsync(Guid adminId, PlatformAdminRole? role, bool? isActive, Guid actingAdminId,
        CancellationToken cancellationToken = default)
    {
        var admin = await catalog.Admins.FirstOrDefaultAsync(a => a.Id == adminId, cancellationToken)
            ?? throw new NotFoundException("Administrator not found.");

        if (adminId == actingAdminId && ((isActive == false) || (role is { } r && r != admin.Role)))
        {
            throw new ValidationException("You cannot switch off your own account or change your own role.");
        }

        var losesOwner = admin.Role == PlatformAdminRole.Owner && admin.IsActive
            && ((role is { } newRole && newRole != PlatformAdminRole.Owner) || isActive == false);
        if (losesOwner && !await catalog.Admins.AnyAsync(a => a.Id != adminId && a.IsActive && a.Role == PlatformAdminRole.Owner, cancellationToken))
        {
            throw new ValidationException("The platform must keep at least one active Owner.");
        }

        if (role is { } changedRole) admin.Role = changedRole;
        if (isActive is { } active) admin.IsActive = active;
        await catalog.SaveChangesAsync(cancellationToken);
        return admin;
    }

    /// <summary>Changes the admin's own password (the current one is required) and clears "must change password".</summary>
    public async Task<PlatformAdmin> ChangePasswordAsync(Guid adminId, string currentPassword, string newPassword, string confirmPassword,
        CancellationToken cancellationToken = default)
    {
        var admin = await catalog.Admins.FirstOrDefaultAsync(a => a.Id == adminId && a.IsActive, cancellationToken)
            ?? throw new UnauthorizedException("Sign-in expired. Please start again.");

        if (_hasher.VerifyHashedPassword(admin, admin.PasswordHash, currentPassword ?? string.Empty) == PasswordVerificationResult.Failed)
        {
            throw new ValidationException("The current password is not correct.");
        }

        var (isValid, error) = PasswordPolicyValidator.Validate(newPassword, confirmPassword, admin.Email);
        if (!isValid)
        {
            throw new ValidationException(error ?? "Invalid password.");
        }
        if (newPassword.Length < MinimumAdminPasswordLength)
        {
            throw new ValidationException($"An admin password must be at least {MinimumAdminPasswordLength} characters long.");
        }
        if (_hasher.VerifyHashedPassword(admin, admin.PasswordHash, newPassword) != PasswordVerificationResult.Failed)
        {
            throw new ValidationException("Choose a password different from the current one.");
        }

        admin.PasswordHash = _hasher.HashPassword(admin, newPassword);
        admin.MustChangePassword = false;
        await catalog.SaveChangesAsync(cancellationToken);
        return admin;
    }

    /// <summary>
    /// First step: email and password. Wrong details, a locked or inactive account all get the same answer. An admin
    /// without 2-step verification gets a new secret to add to an authenticator app.
    /// </summary>
    public async Task<PlatformSignInStep> VerifyPasswordAsync(string email, string password, CancellationToken cancellationToken = default)
    {
        const string invalid = "Invalid email or password.";
        var admin = await catalog.Admins.FirstOrDefaultAsync(a => a.Email == NormalizeEmail(email), cancellationToken);
        var now = DateTime.UtcNow;
        if (admin is null || !admin.IsActive)
        {
            throw new UnauthorizedException(invalid);
        }
        if (admin.LockedUntil is { } locked && locked > now)
        {
            throw new UnauthorizedException("Too many failed attempts. Try again later.");
        }

        if (_hasher.VerifyHashedPassword(admin, admin.PasswordHash, password ?? string.Empty) == PasswordVerificationResult.Failed)
        {
            await RecordFailureAsync(admin, now, cancellationToken);
            throw new UnauthorizedException(invalid);
        }

        if (admin.TotpConfirmed && admin.TotpSecretEncrypted is not null)
        {
            return new PlatformSignInStep(admin, NeedsTotpSetup: false, TotpSecret: null);
        }

        var secret = Totp.NewSecret();
        admin.TotpSecretEncrypted = encryption.Encrypt(secret);
        admin.TotpConfirmed = false;
        await catalog.SaveChangesAsync(cancellationToken);
        return new PlatformSignInStep(admin, NeedsTotpSetup: true, TotpSecret: secret);
    }

    /// <summary>Second step: the authenticator code. Confirms 2-step verification the first time it succeeds.</summary>
    public async Task<PlatformAdmin> VerifyTotpAsync(Guid adminId, string code, CancellationToken cancellationToken = default)
    {
        var admin = await catalog.Admins.FirstOrDefaultAsync(a => a.Id == adminId && a.IsActive, cancellationToken)
            ?? throw new UnauthorizedException("Sign-in expired. Please start again.");
        var now = DateTime.UtcNow;
        if (admin.LockedUntil is { } locked && locked > now)
        {
            throw new UnauthorizedException("Too many failed attempts. Try again later.");
        }

        var secret = admin.TotpSecretEncrypted is null ? null : encryption.Decrypt(admin.TotpSecretEncrypted);
        if (secret is null || !Totp.Verify(secret, code, now))
        {
            await RecordFailureAsync(admin, now, cancellationToken);
            throw new UnauthorizedException("The verification code is not correct.");
        }

        admin.TotpConfirmed = true;
        admin.FailedSignInAttempts = 0;
        admin.LockedUntil = null;
        admin.LastSignInAt = now;
        await catalog.SaveChangesAsync(cancellationToken);
        return admin;
    }

    /// <summary>The link an authenticator app reads (shown as a QR code by the admin portal).</summary>
    public static string AuthenticatorUri(string email, string secret) =>
        $"otpauth://totp/{Uri.EscapeDataString(Issuer)}:{Uri.EscapeDataString(email)}?secret={secret}&issuer={Uri.EscapeDataString(Issuer)}&digits=6&period=30";

    private async Task RecordFailureAsync(PlatformAdmin admin, DateTime now, CancellationToken cancellationToken)
    {
        admin.FailedSignInAttempts++;
        if (admin.FailedSignInAttempts >= MaxFailedAttempts)
        {
            admin.LockedUntil = now.Add(LockoutFor);
            admin.FailedSignInAttempts = 0;
            Log.Warning("Platform admin {Email} locked for {Minutes} minutes after failed sign-ins", admin.Email, LockoutFor.TotalMinutes);
        }
        await catalog.SaveChangesAsync(cancellationToken);
    }

    private static string NormalizeEmail(string email)
    {
        var trimmed = email?.Trim().ToLowerInvariant() ?? string.Empty;
        if (trimmed.Length < 3 || !trimmed.Contains('@')) throw new ValidationException("A valid email is required.");
        return trimmed;
    }

    private static string GeneratePassword() =>
        RandomNumberGenerator.GetString("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789", 20);
}

/// <summary>Time-based one-time codes (RFC 6238: HMAC-SHA1, 30-second steps, 6 digits), as authenticator apps use.</summary>
public static class Totp
{
    private const string Base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    /// <summary>A new 160-bit secret in Base32, the form authenticator apps expect.</summary>
    public static string NewSecret() => ToBase32(RandomNumberGenerator.GetBytes(20));

    /// <summary>Checks a code, allowing one step either side for clock drift.</summary>
    public static bool Verify(string base32Secret, string? code, DateTime utcNow)
    {
        var digits = new string((code ?? string.Empty).Where(char.IsDigit).ToArray());
        if (digits.Length != 6) return false;

        var key = FromBase32(base32Secret);
        var step = new DateTimeOffset(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc)).ToUnixTimeSeconds() / 30;
        for (var offset = -1; offset <= 1; offset++)
        {
            if (CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Compute(key, step + offset)), Encoding.ASCII.GetBytes(digits)))
            {
                return true;
            }
        }
        return false;
    }

    /// <summary>The code for a moment (used by tests and the setup check).</summary>
    public static string CodeAt(string base32Secret, DateTime utc) =>
        Compute(FromBase32(base32Secret), new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeSeconds() / 30);

    private static string Compute(byte[] key, long step)
    {
        var counter = BitConverter.GetBytes(step);
        if (BitConverter.IsLittleEndian) Array.Reverse(counter);
        var hash = HMACSHA1.HashData(key, counter);
        var offset = hash[^1] & 0x0F;
        var binary = ((hash[offset] & 0x7F) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
        return (binary % 1_000_000).ToString("000000");
    }

    private static string ToBase32(byte[] bytes)
    {
        var builder = new StringBuilder();
        int buffer = 0, bits = 0;
        foreach (var b in bytes)
        {
            buffer = (buffer << 8) | b;
            bits += 8;
            while (bits >= 5)
            {
                builder.Append(Base32Alphabet[(buffer >> (bits - 5)) & 31]);
                bits -= 5;
            }
        }
        if (bits > 0) builder.Append(Base32Alphabet[(buffer << (5 - bits)) & 31]);
        return builder.ToString();
    }

    private static byte[] FromBase32(string text)
    {
        var clean = text.Trim().TrimEnd('=').ToUpperInvariant();
        var output = new List<byte>();
        int buffer = 0, bits = 0;
        foreach (var c in clean)
        {
            var value = Base32Alphabet.IndexOf(c);
            if (value < 0) throw new FormatException("Invalid Base32 secret.");
            buffer = (buffer << 5) | value;
            bits += 5;
            if (bits >= 8)
            {
                output.Add((byte)((buffer >> (bits - 8)) & 0xFF));
                bits -= 8;
            }
        }
        return output.ToArray();
    }
}
