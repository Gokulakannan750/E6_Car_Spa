using System.Text.Json;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Settings;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public class SystemPreferenceService : ISystemPreferenceService
{
    private readonly AppDbContext _db;
    private readonly IAuditLogService _auditLogService;

    public SystemPreferenceService(AppDbContext db, IAuditLogService auditLogService)
    {
        _db = db;
        _auditLogService = auditLogService;
    }

    public async Task<SystemPreferenceDto> GetPreferencesAsync(CancellationToken ct = default)
    {
        var prefs = await GetOrCreatePreferencesEntityAsync(ct);
        return ToDto(prefs);
    }

    public async Task<SystemPreferenceDto> UpdatePreferencesAsync(UpdateSystemPreferenceRequest request, Guid? userId = null, CancellationToken ct = default)
    {
        var validationContext = new System.ComponentModel.DataAnnotations.ValidationContext(request);
        var validationResults = request.Validate(validationContext).ToList();
        if (validationResults.Count > 0)
        {
            throw new ValidationException(validationResults.First().ErrorMessage ?? "Validation failed.");
        }

        var prefs = await GetOrCreatePreferencesEntityAsync(ct);

        var previousValues = new
        {
            dateFormat = prefs.DateFormat,
            timeFormat = prefs.TimeFormat,
            currencySymbol = prefs.CurrencySymbol,
            decimalPrecision = prefs.DecimalPrecision,
            defaultPrintCopies = prefs.DefaultPrintCopies,
            autoPrintReceipt = prefs.AutoPrintReceipt,
            refreshInterval = prefs.RefreshInterval
        };

        prefs.DateFormat = request.DateFormat.Trim();
        prefs.TimeFormat = request.TimeFormat.Trim();
        prefs.CurrencySymbol = request.CurrencySymbol.Trim();
        prefs.DecimalPrecision = request.DecimalPrecision;
        prefs.DefaultPrintCopies = request.DefaultPrintCopies;
        prefs.AutoPrintReceipt = request.AutoPrintReceipt;
        prefs.RefreshInterval = request.RefreshInterval;
        prefs.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        var newValues = new
        {
            dateFormat = prefs.DateFormat,
            timeFormat = prefs.TimeFormat,
            currencySymbol = prefs.CurrencySymbol,
            decimalPrecision = prefs.DecimalPrecision,
            defaultPrintCopies = prefs.DefaultPrintCopies,
            autoPrintReceipt = prefs.AutoPrintReceipt,
            refreshInterval = prefs.RefreshInterval
        };

        await _auditLogService.RecordAsync(
            action: AuditActions.SystemPreferencesUpdated,
            module: AuditModules.Settings,
            description: "System preferences updated.",
            entityType: "SystemPreference",
            entityId: prefs.Id,
            entityReference: "BusinessSystemPreferences",
            oldValues: JsonSerializer.Serialize(previousValues),
            newValues: JsonSerializer.Serialize(newValues),
            userId: userId,
            outcome: "Success",
            cancellationToken: ct);

        return ToDto(prefs);
    }

    private async Task<SystemPreference> GetOrCreatePreferencesEntityAsync(CancellationToken ct)
    {
        var prefs = await _db.SystemPreferences
            .FirstOrDefaultAsync(s => s.SingletonKey == 1 && !s.IsDeleted, ct);

        if (prefs != null) return prefs;

        // Initialize canonical default system preferences
        prefs = new SystemPreference
        {
            Id = Guid.NewGuid(),
            SingletonKey = 1,
            DateFormat = "DD/MM/YYYY",
            TimeFormat = "12h",
            CurrencySymbol = "₹",
            DecimalPrecision = 2,
            DefaultPrintCopies = 1,
            AutoPrintReceipt = true,
            RefreshInterval = 30,
            CreatedAt = DateTime.UtcNow
        };

        _db.SystemPreferences.Add(prefs);
        await _db.SaveChangesAsync(ct);

        return prefs;
    }

    private static SystemPreferenceDto ToDto(SystemPreference s) => new(
        s.DateFormat,
        s.TimeFormat,
        s.CurrencySymbol,
        s.DecimalPrecision,
        s.DefaultPrintCopies,
        s.AutoPrintReceipt,
        s.RefreshInterval,
        s.UpdatedAt
    );
}
