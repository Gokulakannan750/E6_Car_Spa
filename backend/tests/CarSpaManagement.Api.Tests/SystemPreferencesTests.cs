using System.ComponentModel.DataAnnotations;
using System.Reflection;
using System.Text.Json;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Settings;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Controllers;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Authorization;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CarSpaManagement.Api.Tests;

public class SystemPreferencesTests
{
    private class MockAuditLogService : IAuditLogService
    {
        public List<(string action, string module, string description, string? oldValues, string? newValues, Guid? userId)> RecordedLogs { get; } = new();

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
            RecordedLogs.Add((action, module, description, oldValues, newValues, userId));
            return Task.CompletedTask;
        }

        public Task<Application.DTOs.Audit.PagedResult<Application.DTOs.Audit.AuditLogDto>> GetLogsAsync(
            Application.DTOs.Audit.AuditLogQueryParameters query,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new Application.DTOs.Audit.PagedResult<Application.DTOs.Audit.AuditLogDto>());
        }
    }

    private static AppDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task GetPreferencesAsync_WhenNoRecordExists_CreatesAndReturnsCanonicalDefaults()
    {
        using var db = CreateInMemoryDb();
        var audit = new MockAuditLogService();
        var service = new SystemPreferenceService(db, audit);

        var prefs = await service.GetPreferencesAsync();

        Assert.NotNull(prefs);
        Assert.Equal("DD/MM/YYYY", prefs.DateFormat);
        Assert.Equal("12h", prefs.TimeFormat);
        Assert.Equal("₹", prefs.CurrencySymbol);
        Assert.Equal(2, prefs.DecimalPrecision);
        Assert.Equal(1, prefs.DefaultPrintCopies);
        Assert.True(prefs.AutoPrintReceipt);
        Assert.Equal(30, prefs.RefreshInterval);

        // Verify persisted to DB
        var dbRecord = await db.SystemPreferences.FirstOrDefaultAsync();
        Assert.NotNull(dbRecord);
        Assert.Equal(1, dbRecord.SingletonKey);
    }

    [Fact]
    public async Task UpdatePreferencesAsync_WithValidValues_PersistsAndLogsAudit()
    {
        using var db = CreateInMemoryDb();
        var audit = new MockAuditLogService();
        var service = new SystemPreferenceService(db, audit);
        var testUserId = Guid.NewGuid();

        var request = new UpdateSystemPreferenceRequest
        {
            DateFormat = "YYYY-MM-DD",
            TimeFormat = "24h",
            CurrencySymbol = "$",
            DecimalPrecision = 0,
            DefaultPrintCopies = 3,
            AutoPrintReceipt = false,
            RefreshInterval = 60
        };

        var updated = await service.UpdatePreferencesAsync(request, testUserId);

        Assert.Equal("YYYY-MM-DD", updated.DateFormat);
        Assert.Equal("24h", updated.TimeFormat);
        Assert.Equal("$", updated.CurrencySymbol);
        Assert.Equal(0, updated.DecimalPrecision);
        Assert.Equal(3, updated.DefaultPrintCopies);
        Assert.False(updated.AutoPrintReceipt);
        Assert.Equal(60, updated.RefreshInterval);
        Assert.NotNull(updated.UpdatedAt);

        // Verify DB entity
        var dbRecord = await db.SystemPreferences.FirstAsync();
        Assert.Equal("YYYY-MM-DD", dbRecord.DateFormat);
        Assert.Equal("24h", dbRecord.TimeFormat);
        Assert.Equal("$", dbRecord.CurrencySymbol);
        Assert.Equal(0, dbRecord.DecimalPrecision);
        Assert.Equal(3, dbRecord.DefaultPrintCopies);
        Assert.False(dbRecord.AutoPrintReceipt);
        Assert.Equal(60, dbRecord.RefreshInterval);

        // Verify audit log
        Assert.Single(audit.RecordedLogs);
        var log = audit.RecordedLogs.First();
        Assert.Equal(AuditActions.SystemPreferencesUpdated, log.action);
        Assert.Equal(AuditModules.Settings, log.module);
        Assert.Equal(testUserId, log.userId);
    }

    [Theory]
    [InlineData("DD/MM/YYYY", true)]
    [InlineData("MM/DD/YYYY", true)]
    [InlineData("YYYY-MM-DD", true)]
    [InlineData("INVALID_DATE_FORMAT", false)]
    [InlineData("", false)]
    public void UpdateSystemPreferenceRequest_ValidatesDateFormats(string format, bool isValid)
    {
        var request = new UpdateSystemPreferenceRequest { DateFormat = format };
        var context = new ValidationContext(request);
        var results = request.Validate(context).ToList();

        if (isValid)
        {
            Assert.DoesNotContain(results, r => r.MemberNames.Contains(nameof(request.DateFormat)));
        }
        else
        {
            Assert.Contains(results, r => r.MemberNames.Contains(nameof(request.DateFormat)));
        }
    }

    [Theory]
    [InlineData("12h", true)]
    [InlineData("24h", true)]
    [InlineData("48h", false)]
    [InlineData("unknown", false)]
    public void UpdateSystemPreferenceRequest_ValidatesTimeFormats(string format, bool isValid)
    {
        var request = new UpdateSystemPreferenceRequest { TimeFormat = format };
        var context = new ValidationContext(request);
        var results = request.Validate(context).ToList();

        if (isValid)
        {
            Assert.DoesNotContain(results, r => r.MemberNames.Contains(nameof(request.TimeFormat)));
        }
        else
        {
            Assert.Contains(results, r => r.MemberNames.Contains(nameof(request.TimeFormat)));
        }
    }

    [Theory]
    [InlineData("₹", true)]
    [InlineData("$", true)]
    [InlineData("€", true)]
    [InlineData("£", false)]
    [InlineData("¥", false)]
    public void UpdateSystemPreferenceRequest_ValidatesCurrencySymbols(string symbol, bool isValid)
    {
        var request = new UpdateSystemPreferenceRequest { CurrencySymbol = symbol };
        var context = new ValidationContext(request);
        var results = request.Validate(context).ToList();

        if (isValid)
        {
            Assert.DoesNotContain(results, r => r.MemberNames.Contains(nameof(request.CurrencySymbol)));
        }
        else
        {
            Assert.Contains(results, r => r.MemberNames.Contains(nameof(request.CurrencySymbol)));
        }
    }

    [Theory]
    [InlineData(0, true)]
    [InlineData(2, true)]
    [InlineData(1, false)]
    [InlineData(3, false)]
    public void UpdateSystemPreferenceRequest_ValidatesDecimalPrecision(int precision, bool isValid)
    {
        var request = new UpdateSystemPreferenceRequest { DecimalPrecision = precision };
        var context = new ValidationContext(request);
        var results = request.Validate(context).ToList();

        if (isValid)
        {
            Assert.DoesNotContain(results, r => r.MemberNames.Contains(nameof(request.DecimalPrecision)));
        }
        else
        {
            Assert.Contains(results, r => r.MemberNames.Contains(nameof(request.DecimalPrecision)));
        }
    }

    [Theory]
    [InlineData(1, true)]
    [InlineData(2, true)]
    [InlineData(3, true)]
    [InlineData(0, false)]
    [InlineData(4, false)]
    public void UpdateSystemPreferenceRequest_ValidatesPrintCopies(int copies, bool isValid)
    {
        var request = new UpdateSystemPreferenceRequest { DefaultPrintCopies = copies };
        var context = new ValidationContext(request);
        var results = request.Validate(context).ToList();

        if (isValid)
        {
            Assert.DoesNotContain(results, r => r.MemberNames.Contains(nameof(request.DefaultPrintCopies)));
        }
        else
        {
            Assert.Contains(results, r => r.MemberNames.Contains(nameof(request.DefaultPrintCopies)));
        }
    }

    [Theory]
    [InlineData(0, true)]
    [InlineData(15, true)]
    [InlineData(30, true)]
    [InlineData(60, true)]
    [InlineData(45, false)]
    [InlineData(120, false)]
    public void UpdateSystemPreferenceRequest_ValidatesRefreshIntervals(int interval, bool isValid)
    {
        var request = new UpdateSystemPreferenceRequest { RefreshInterval = interval };
        var context = new ValidationContext(request);
        var results = request.Validate(context).ToList();

        if (isValid)
        {
            Assert.DoesNotContain(results, r => r.MemberNames.Contains(nameof(request.RefreshInterval)));
        }
        else
        {
            Assert.Contains(results, r => r.MemberNames.Contains(nameof(request.RefreshInterval)));
        }
    }

    [Fact]
    public void Controller_RouteAndPermissions_AreCorrect()
    {
        var controllerType = typeof(SystemPreferencesController);
        var routeAttr = controllerType.GetCustomAttribute<RouteAttribute>();
        Assert.NotNull(routeAttr);
        Assert.Equal("api/settings/system", routeAttr.Template);

        var getMethod = controllerType.GetMethod(nameof(SystemPreferencesController.GetPreferences));
        Assert.NotNull(getMethod);
        var getPerm = getMethod.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(getPerm);
        Assert.Equal("Permission:settings.view", getPerm.Policy);

        var putMethod = controllerType.GetMethod(nameof(SystemPreferencesController.UpdatePreferences));
        Assert.NotNull(putMethod);
        var putPerm = putMethod.GetCustomAttribute<RequirePermissionAttribute>();
        Assert.NotNull(putPerm);
        Assert.Equal("Permission:settings.business", putPerm.Policy);
    }

    [Fact]
    public void SystemPreferenceDto_JsonSerialization_MatchesCamelCaseContract()
    {
        var dto = new SystemPreferenceDto(
            DateFormat: "DD/MM/YYYY",
            TimeFormat: "12h",
            CurrencySymbol: "₹",
            DecimalPrecision: 2,
            DefaultPrintCopies: 1,
            AutoPrintReceipt: true,
            RefreshInterval: 30,
            UpdatedAt: null
        );

        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        var json = JsonSerializer.Serialize(dto, jsonOptions);

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.True(root.TryGetProperty("dateFormat", out var df) && df.GetString() == "DD/MM/YYYY");
        Assert.True(root.TryGetProperty("timeFormat", out var tf) && tf.GetString() == "12h");
        Assert.True(root.TryGetProperty("currencySymbol", out var cs) && cs.GetString() == "₹");
        Assert.True(root.TryGetProperty("decimalPrecision", out var dp) && dp.GetInt32() == 2);
        Assert.True(root.TryGetProperty("defaultPrintCopies", out var pc) && pc.GetInt32() == 1);
        Assert.True(root.TryGetProperty("autoPrintReceipt", out var ap) && ap.GetBoolean());
        Assert.True(root.TryGetProperty("refreshInterval", out var ri) && ri.GetInt32() == 30);
    }
}
