using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Options;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class AuthServiceSecurityTests
{
    private class DummyAuditLogService : IAuditLogService
    {
        public Task RecordAsync(
            string action,
            string module,
            string description,
            Guid? userId = null,
            string? userName = null,
            string? userRole = null,
            string? entityType = null,
            Guid? entityId = null,
            string? entityReference = null,
            string? oldValues = null,
            string? newValues = null,
            string? metadata = null,
            string outcome = "Success",
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public Task<PagedResult<AuditLogDto>> GetLogsAsync(
            AuditLogQueryParameters query,
            CancellationToken cancellationToken = default)
        {
            throw new NotImplementedException();
        }
    }

    private static (AppDbContext db, AuthService authService) CreateTestContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var db = new AppDbContext(options);

        var passwordHasher = new PasswordHasherService();
        var jwtOptions = Options.Create(new JwtOptions
        {
            Key = "test_signing_key_32_bytes_length_minimum_for_sha256!",
            Issuer = "E6CarSpa",
            Audience = "E6CarSpaDesktop",
            ExpirationMinutes = 60
        });
        var jwtService = new JwtTokenService(jwtOptions);
        var auditService = new DummyAuditLogService();

        var authService = new AuthService(db, passwordHasher, jwtService, auditService);
        return (db, authService);
    }

    [Fact]
    public async Task LoginAsync_WithValidCredentials_SucceedsWithoutExposingPasswordHash()
    {
        var (db, authService) = CreateTestContext();
        var hasher = new PasswordHasherService();

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Admin Test",
            Username = "admintest",
            Role = UserRole.Owner,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = hasher.HashPassword(user, "ValidPassword123!");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var response = await authService.LoginAsync(new LoginRequest
        {
            Username = "admintest",
            Password = "ValidPassword123!"
        });

        Assert.NotNull(response);
        Assert.NotEmpty(response.Token);
        Assert.NotNull(response.User);
        Assert.Equal("admintest", response.User.Username);
        Assert.True(response.User.IsOwner);

        // Verify response DTO has no PasswordHash field
        var userProperties = typeof(AuthUserDto).GetProperties();
        Assert.DoesNotContain(userProperties, p => p.Name.Contains("Password", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task LoginAsync_WithInvalidPassword_ThrowsUnauthorizedExceptionWithGenericMessage()
    {
        var (db, authService) = CreateTestContext();
        var hasher = new PasswordHasherService();

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Test User",
            Username = "testuser",
            Role = UserRole.Staff,
            IsActive = true
        };
        user.PasswordHash = hasher.HashPassword(user, "CorrectPassword123!");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<UnauthorizedException>(() => authService.LoginAsync(new LoginRequest
        {
            Username = "testuser",
            Password = "WrongPassword123!"
        }));

        Assert.Equal("Invalid username or password.", ex.Message);
    }

    [Fact]
    public async Task LoginAsync_WithInactiveUser_ThrowsUnauthorizedExceptionWithGenericMessage()
    {
        var (db, authService) = CreateTestContext();
        var hasher = new PasswordHasherService();

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Deactivated User",
            Username = "inactiveuser",
            Role = UserRole.Staff,
            IsActive = false
        };
        user.PasswordHash = hasher.HashPassword(user, "SomePassword123!");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<UnauthorizedException>(() => authService.LoginAsync(new LoginRequest
        {
            Username = "inactiveuser",
            Password = "SomePassword123!"
        }));

        Assert.Equal("Invalid username or password.", ex.Message);
    }

    [Fact]
    public async Task LoginAsync_WithNonExistentUser_ThrowsUnauthorizedExceptionWithGenericMessage()
    {
        var (_, authService) = CreateTestContext();

        var ex = await Assert.ThrowsAsync<UnauthorizedException>(() => authService.LoginAsync(new LoginRequest
        {
            Username = "doesnotexist",
            Password = "SomePassword123!"
        }));

        Assert.Equal("Invalid username or password.", ex.Message);
    }

    [Fact]
    public async Task BootstrapOwnerAsync_OnEmptyDatabase_CreatesOwner()
    {
        var (db, authService) = CreateTestContext();

        var statusBefore = await authService.GetStatusAsync();
        Assert.False(statusBefore.Initialized);

        var result = await authService.BootstrapOwnerAsync(new BootstrapOwnerRequest
        {
            FullName = "Initial Owner",
            Username = "owner",
            Password = "OwnerPassword123!",
            ConfirmPassword = "OwnerPassword123!"
        });

        Assert.NotNull(result);
        Assert.Equal("owner", result.Username);
        Assert.True(result.IsOwner);

        var statusAfter = await authService.GetStatusAsync();
        Assert.True(statusAfter.Initialized);
    }

    [Fact]
    public async Task BootstrapOwnerAsync_WhenUsersAlreadyExist_ThrowsConflictException()
    {
        var (db, authService) = CreateTestContext();
        db.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            FullName = "Existing User",
            Username = "existing",
            Role = UserRole.Owner,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<ConflictException>(() => authService.BootstrapOwnerAsync(new BootstrapOwnerRequest
        {
            FullName = "Second Owner",
            Username = "secondowner",
            Password = "OwnerPassword123!",
            ConfirmPassword = "OwnerPassword123!"
        }));

        Assert.Contains("already initialized", ex.Message);
    }
}
