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

public class AccountLockoutSecurityTests
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

    private static (AppDbContext db, AuthService authService, AccountLockoutService lockoutService, User testUser) CreateTestContext()
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
        var lockoutService = new AccountLockoutService();

        var authService = new AuthService(db, passwordHasher, jwtService, auditService, lockoutService);

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Test Lockout User",
            Username = "lockoutuser",
            Role = UserRole.Staff,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = passwordHasher.HashPassword(user, "CorrectPassword123!");
        db.Users.Add(user);
        db.SaveChanges();

        return (db, authService, lockoutService, user);
    }

    [Fact]
    public async Task FailedAttempts_1To4_AreAllowedWith401Unauthorized()
    {
        var (_, authService, _, _) = CreateTestContext();

        for (int i = 1; i <= 4; i++)
        {
            var ex = await Assert.ThrowsAsync<UnauthorizedException>(() => authService.LoginAsync(new LoginRequest
            {
                Username = "lockoutuser",
                Password = $"WrongPassword{i}!"
            }));
            Assert.Equal("Invalid username or password.", ex.Message);
        }
    }

    [Fact]
    public async Task FifthFailedAttempt_TriggersLockoutWithAccountLockedException()
    {
        var (_, authService, _, _) = CreateTestContext();

        // 4 failed attempts
        for (int i = 1; i <= 4; i++)
        {
            await Assert.ThrowsAsync<UnauthorizedException>(() => authService.LoginAsync(new LoginRequest
            {
                Username = "lockoutuser",
                Password = $"WrongPassword{i}!"
            }));
        }

        // 5th failed attempt triggers lockout
        var lockedEx = await Assert.ThrowsAsync<AccountLockedException>(() => authService.LoginAsync(new LoginRequest
        {
            Username = "lockoutuser",
            Password = "WrongPassword5!"
        }));

        Assert.Equal("Too many failed login attempts. Please try again later.", lockedEx.Message);
        Assert.True(lockedEx.RemainingLockoutSeconds > 0 && lockedEx.RemainingLockoutSeconds <= 300);
    }

    [Fact]
    public async Task LoginDuringLockout_EvenWithCorrectPassword_IsRejected()
    {
        var (_, authService, _, _) = CreateTestContext();

        // Trigger lockout with 5 failed attempts
        for (int i = 1; i <= 5; i++)
        {
            try
            {
                await authService.LoginAsync(new LoginRequest
                {
                    Username = "lockoutuser",
                    Password = $"WrongPassword{i}!"
                });
            }
            catch (Exception) { }
        }

        // Attempt login with correct password during lockout
        var lockedEx = await Assert.ThrowsAsync<AccountLockedException>(() => authService.LoginAsync(new LoginRequest
        {
            Username = "lockoutuser",
            Password = "CorrectPassword123!"
        }));

        Assert.Equal("Too many failed login attempts. Please try again later.", lockedEx.Message);
        Assert.True(lockedEx.RemainingLockoutSeconds > 0);
    }

    [Fact]
    public async Task SuccessfulLogin_ResetsFailedAttemptCounter()
    {
        var (_, authService, _, _) = CreateTestContext();

        // 4 failed attempts
        for (int i = 1; i <= 4; i++)
        {
            await Assert.ThrowsAsync<UnauthorizedException>(() => authService.LoginAsync(new LoginRequest
            {
                Username = "lockoutuser",
                Password = $"WrongPassword{i}!"
            }));
        }

        // 1 successful login resets counter
        var successResponse = await authService.LoginAsync(new LoginRequest
        {
            Username = "lockoutuser",
            Password = "CorrectPassword123!"
        });
        Assert.NotNull(successResponse.Token);

        // 4 more failed attempts should not trigger lockout because counter was reset
        for (int i = 1; i <= 4; i++)
        {
            var ex = await Assert.ThrowsAsync<UnauthorizedException>(() => authService.LoginAsync(new LoginRequest
            {
                Username = "lockoutuser",
                Password = $"WrongPasswordAfterReset{i}!"
            }));
            Assert.Equal("Invalid username or password.", ex.Message);
        }
    }

    [Fact]
    public async Task NonExistentUsername_FollowsSameLockoutRule_PreventingUserEnumeration()
    {
        var (_, authService, _, _) = CreateTestContext();

        for (int i = 1; i <= 4; i++)
        {
            var ex = await Assert.ThrowsAsync<UnauthorizedException>(() => authService.LoginAsync(new LoginRequest
            {
                Username = "nonexistentuser",
                Password = $"RandomPass{i}!"
            }));
            Assert.Equal("Invalid username or password.", ex.Message);
        }

        // 5th attempt on non-existent username also locks out with identical message
        var lockedEx = await Assert.ThrowsAsync<AccountLockedException>(() => authService.LoginAsync(new LoginRequest
        {
            Username = "nonexistentuser",
            Password = "RandomPass5!"
        }));

        Assert.Equal("Too many failed login attempts. Please try again later.", lockedEx.Message);
        Assert.True(lockedEx.RemainingLockoutSeconds > 0);
    }

    [Fact]
    public async Task Reset_ClearsLockoutAndAllowsLoginImmediately()
    {
        var (_, authService, lockoutService, _) = CreateTestContext();

        // Trigger lockout
        for (int i = 1; i <= 5; i++)
        {
            try
            {
                await authService.LoginAsync(new LoginRequest
                {
                    Username = "lockoutuser",
                    Password = $"WrongPassword{i}!"
                });
            }
            catch (Exception) { }
        }

        // Verify locked
        await Assert.ThrowsAsync<AccountLockedException>(() => authService.LoginAsync(new LoginRequest
        {
            Username = "lockoutuser",
            Password = "CorrectPassword123!"
        }));

        // Reset lockout
        lockoutService.Reset("lockoutuser");

        // Now login should succeed
        var response = await authService.LoginAsync(new LoginRequest
        {
            Username = "lockoutuser",
            Password = "CorrectPassword123!"
        });
        Assert.NotNull(response.Token);
    }
}
