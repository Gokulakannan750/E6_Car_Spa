using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.StaffAdvances;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class StaffMasterTests
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
            return Task.FromResult(new PagedResult<AuditLogDto>
            {
                Items = new List<AuditLogDto>(),
                TotalCount = 0,
                Page = query.Page,
                PageSize = query.PageSize
            });
        }
    }

    private class DummyEncryptionService : IAesEncryptionService
    {
        public string? Encrypt(string? plainText) => plainText == null ? null : $"ENC:{plainText}";
        public string? Decrypt(string? cipherText) => cipherText == null ? null : (cipherText.StartsWith("ENC:") ? cipherText[4..] : cipherText);
        public string ComputeHash(string input) => $"HASH:{input}";
    }

    private static (AppDbContext db, IStaffAdvanceService staffService) CreateTestContext()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName)
                   .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));

        services.AddSingleton<IAuditLogService, DummyAuditLogService>();
        services.AddSingleton<IAesEncryptionService, DummyEncryptionService>();
        services.AddScoped<IStaffAdvanceService, StaffAdvanceService>();

        var provider = services.BuildServiceProvider();
        var db = provider.GetRequiredService<AppDbContext>();
        var staffService = provider.GetRequiredService<IStaffAdvanceService>();

        return (db, staffService);
    }

    [Theory]
    [InlineData("Gokul", "GO", "L")]
    [InlineData("Gokulakannan", "GO", "N")]
    [InlineData("Karthik Raja", "KA", "A")]
    [InlineData("Senthil Nathan", "SE", "N")]
    [InlineData("Ramesh Kumar", "RA", "R")]
    [InlineData("A", "AX", "A")]
    [InlineData("12345", "XX", "X")]
    [InlineData("  John Doe  ", "JO", "E")]
    public void DerivePrefixAndSuffix_DerivesCorrectComponents(string input, string expectedPrefix, string expectedSuffix)
    {
        var (prefix, suffix) = StaffAdvanceService.DerivePrefixAndSuffix(input);
        Assert.Equal(expectedPrefix, prefix);
        Assert.Equal(expectedSuffix, suffix);
    }

    [Fact]
    public async Task CreateStaffMemberAsync_GeneratesStaffMasterId_MatchingRequiredFormat()
    {
        var (_, service) = CreateTestContext();

        var request = new CreateStaffRequest
        {
            Name = "Gokul",
            PhoneNumber = "9876543210",
            AadhaarNumber = "123456789012",
            Email = "gokul@e6carspa.com",
            Address = "Coimbatore",
            Role = "Technician",
            IsActive = true
        };

        var result = await service.CreateStaffMemberAsync(request);

        Assert.NotNull(result);
        Assert.NotNull(result.StaffMasterId);
        Assert.Equal(6, result.StaffMasterId.Length);
        Assert.Matches(@"^[A-Z]{2}[0-9]{3}[A-Z]$", result.StaffMasterId);
        Assert.Equal("GO001L", result.StaffMasterId);
    }

    [Fact]
    public async Task CreateStaffMemberAsync_GeneratesSequentialMasterIds_ForSamePrefixAndSuffix()
    {
        var (_, service) = CreateTestContext();

        var s1 = await service.CreateStaffMemberAsync(new CreateStaffRequest
        {
            Name = "Gokulakannan",
            PhoneNumber = "9876543210",
            AadhaarNumber = "123456789012"
        });

        var s2 = await service.CreateStaffMemberAsync(new CreateStaffRequest
        {
            Name = "Gokulapalan",
            PhoneNumber = "9876543211",
            AadhaarNumber = "123456789013"
        });

        var s3 = await service.CreateStaffMemberAsync(new CreateStaffRequest
        {
            Name = "Gopalakrishnan",
            PhoneNumber = "9876543212",
            AadhaarNumber = "123456789014"
        });

        Assert.Equal("GO001N", s1.StaffMasterId);
        Assert.Equal("GO002N", s2.StaffMasterId);
        Assert.Equal("GO003N", s3.StaffMasterId);
    }

    [Fact]
    public async Task UpdateStaffMemberAsync_DoesNotChangeStaffMasterId_EvenWhenNameChanges()
    {
        var (_, service) = CreateTestContext();

        var created = await service.CreateStaffMemberAsync(new CreateStaffRequest
        {
            Name = "Karthik Raja",
            PhoneNumber = "9876543210",
            AadhaarNumber = "123456789012"
        });

        var originalMasterId = created.StaffMasterId;
        Assert.Equal("KA001A", originalMasterId);

        // Update name completely (to something with different prefix/suffix)
        var updated = await service.UpdateStaffMemberAsync(created.Id, new UpdateStaffRequest
        {
            Name = "Ramesh Kumar Updated",
            PhoneNumber = "9876543299",
            Email = "ramesh@e6carspa.com",
            Address = "New Address",
            Role = "Senior Technician",
            IsActive = false
        });

        Assert.NotNull(updated);
        Assert.Equal("Ramesh Kumar Updated", updated.Name);
        Assert.Equal(originalMasterId, updated.StaffMasterId); // Master ID MUST remain immutable
    }

    [Fact]
    public void StaffDto_And_Requests_DoNotAllowClientSuppliedMasterId()
    {
        // Assert that CreateStaffRequest and UpdateStaffRequest do NOT have a StaffMasterId property
        var createProperties = typeof(CreateStaffRequest).GetProperties().Select(p => p.Name);
        Assert.DoesNotContain("StaffMasterId", createProperties);

        var updateProperties = typeof(UpdateStaffRequest).GetProperties().Select(p => p.Name);
        Assert.DoesNotContain("StaffMasterId", updateProperties);

        // Assert that StaffDto exposes both internal Guid Id and human-readable StaffMasterId
        var dtoProperties = typeof(StaffDto).GetProperties().Select(p => p.Name);
        Assert.Contains("Id", dtoProperties);
        Assert.Contains("StaffMasterId", dtoProperties);
    }

    [Fact]
    public async Task ExistingStaffRecords_WithoutMasterId_CanBeBackfilledDeterministically()
    {
        var (db, service) = CreateTestContext();

        // Simulate 3 legacy records in database without MasterId
        var legacyStaff1 = new Staff
        {
            Id = Guid.NewGuid(),
            Name = "Karthik Raja",
            PhoneNumber = "9876540001",
            StaffMasterId = "",
            AadhaarNumberEncrypted = "ENC:111122223333",
            CreatedAt = DateTime.UtcNow.AddDays(-10)
        };
        var legacyStaff2 = new Staff
        {
            Id = Guid.NewGuid(),
            Name = "Kavitha",
            PhoneNumber = "9876540002",
            StaffMasterId = "",
            AadhaarNumberEncrypted = "ENC:111122223334",
            CreatedAt = DateTime.UtcNow.AddDays(-5)
        };
        var legacyStaff3 = new Staff
        {
            Id = Guid.NewGuid(),
            Name = "Gokul",
            PhoneNumber = "9876540003",
            StaffMasterId = "",
            AadhaarNumberEncrypted = "ENC:111122223335",
            CreatedAt = DateTime.UtcNow.AddDays(-1)
        };

        db.Staff.AddRange(legacyStaff1, legacyStaff2, legacyStaff3);
        await db.SaveChangesAsync();

        // Run the backfill algorithm logic
        var unassigned = await db.Staff.Where(s => string.IsNullOrEmpty(s.StaffMasterId)).OrderBy(s => s.CreatedAt).ToListAsync();
        foreach (var staff in unassigned)
        {
            var (prefix, suffix) = StaffAdvanceService.DerivePrefixAndSuffix(staff.Name);
            var existingIds = await db.Staff
                .Where(s => s.StaffMasterId.StartsWith(prefix) && s.StaffMasterId.EndsWith(suffix) && s.StaffMasterId.Length == 6)
                .Select(s => s.StaffMasterId)
                .ToListAsync();

            var existingSet = new HashSet<string>(existingIds, StringComparer.OrdinalIgnoreCase);
            for (var seq = 1; seq <= 999; seq++)
            {
                var candidate = $"{prefix}{seq:D3}{suffix}";
                if (!existingSet.Contains(candidate))
                {
                    staff.StaffMasterId = candidate;
                    await db.SaveChangesAsync();
                    break;
                }
            }
        }

        // Verify all received valid, unique Master IDs
        var reloaded1 = await db.Staff.FindAsync(legacyStaff1.Id);
        var reloaded2 = await db.Staff.FindAsync(legacyStaff2.Id);
        var reloaded3 = await db.Staff.FindAsync(legacyStaff3.Id);

        Assert.Equal("KA001A", reloaded1!.StaffMasterId);
        Assert.Equal("KA002A", reloaded2!.StaffMasterId); // Same KA...A prefix/suffix incremented sequence
        Assert.Equal("GO001L", reloaded3!.StaffMasterId);

        Assert.Matches(@"^[A-Z]{2}[0-9]{3}[A-Z]$", reloaded1.StaffMasterId);
        Assert.Matches(@"^[A-Z]{2}[0-9]{3}[A-Z]$", reloaded2.StaffMasterId);
        Assert.Matches(@"^[A-Z]{2}[0-9]{3}[A-Z]$", reloaded3.StaffMasterId);
    }
}
