using System.Security.Claims;
using System.Text.Json;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Settings;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

/// <summary>Invoice Configuration in Settings: view both series, and (Owner only) change their prefixes.</summary>
public class InvoiceSeriesService(
    AppDbContext db,
    IAuditLogService auditLogService,
    IHttpContextAccessor httpContextAccessor) : IInvoiceSeriesService
{
    private readonly InvoiceNumberAllocator _allocator = new(db);

    public async Task<InvoiceSeriesSettingsDto> GetAsync(CancellationToken cancellationToken = default)
    {
        var all = await _allocator.GetOrCreateSeriesAsync(cancellationToken);
        return new InvoiceSeriesSettingsDto(
            await ToDtoAsync(all.Single(s => s.SeriesKind == InvoiceSeriesKind.Gst), cancellationToken),
            await ToDtoAsync(all.Single(s => s.SeriesKind == InvoiceSeriesKind.NonGst), cancellationToken));
    }

    public async Task<InvoiceSeriesSettingsDto> UpdatePrefixesAsync(UpdateInvoiceSeriesRequest request, CancellationToken cancellationToken = default)
    {
        var userId = GetCurrentUserId();
        var isOwner = userId.HasValue && await db.Users.AsNoTracking()
            .AnyAsync(u => u.Id == userId.Value && u.IsActive && u.Role == UserRole.Owner, cancellationToken);
        if (!isOwner)
            throw new ForbiddenException("Only the Owner can change invoice number prefixes.");

        var gstPrefix = InvoiceNumberRules.NormalizePrefix(request.GstPrefix);
        var nonGstPrefix = InvoiceNumberRules.NormalizePrefix(request.NonGstPrefix);
        if (string.Equals(gstPrefix, nonGstPrefix, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("GST and non-GST prefixes must be different.");

        await _allocator.GetOrCreateSeriesAsync(cancellationToken);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Lock both series so no finalization issues a number while a prefix is changing.
            var gst = await _allocator.LockSeriesAsync(InvoiceSeriesKind.Gst, cancellationToken);
            var nonGst = await _allocator.LockSeriesAsync(InvoiceSeriesKind.NonGst, cancellationToken);
            var oldGstPrefix = gst.Prefix;
            var oldNonGstPrefix = nonGst.Prefix;

            if (oldGstPrefix != gstPrefix || oldNonGstPrefix != nonGstPrefix)
            {
                // Two steps, so swapping the two prefixes cannot trip the unique-prefix index mid-update.
                gst.Prefix = "#GST-TMP";
                nonGst.Prefix = "#BILL-TMP";
                await db.SaveChangesAsync(cancellationToken);
                gst.Prefix = gstPrefix;
                nonGst.Prefix = nonGstPrefix;
                await db.SaveChangesAsync(cancellationToken);

                await auditLogService.RecordAsync(
                    action: Domain.Constants.AuditActions.InvoiceSeriesPrefixChanged,
                    module: "Settings",
                    description: $"Invoice number prefixes changed: GST '{oldGstPrefix}' to '{gstPrefix}', non-GST '{oldNonGstPrefix}' to '{nonGstPrefix}'.",
                    userId: userId,
                    entityType: "InvoiceNumberSeries",
                    oldValues: JsonSerializer.Serialize(new { gstPrefix = oldGstPrefix, nonGstPrefix = oldNonGstPrefix }),
                    newValues: JsonSerializer.Serialize(new { gstPrefix, nonGstPrefix }),
                    outcome: "Success",
                    cancellationToken: cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation })
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("GST and non-GST prefixes must be different.");
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }

        return await GetAsync(cancellationToken);
    }

    private async Task<InvoiceSeriesDto> ToDtoAsync(InvoiceNumberSeries series, CancellationToken cancellationToken)
    {
        var (counter, number) = await _allocator.PreviewNextAsync(series, cancellationToken);
        return new InvoiceSeriesDto(
            series.SeriesKind.ToString(),
            series.Prefix,
            series.MinDigits,
            counter,
            counter.ToString().PadLeft(series.MinDigits, '0'),
            number);
    }

    private Guid? GetCurrentUserId()
    {
        var user = httpContextAccessor.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true) return null;
        var id = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        return Guid.TryParse(id, out var parsed) ? parsed : null;
    }
}
