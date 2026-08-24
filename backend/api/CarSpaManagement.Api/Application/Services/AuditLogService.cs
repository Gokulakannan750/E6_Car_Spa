using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace CarSpaManagement.Api.Application.Services;

public class AuditLogService : IAuditLogService
{
    private readonly AppDbContext _db;
    private readonly IHttpContextAccessor _httpContextAccessor;

    private static readonly string[] SensitiveKeywords =
    [
        "password",
        "passwordhash",
        "hash",
        "token",
        "accesstoken",
        "refreshtoken",
        "jwt",
        "secret",
        "apikey",
        "clientsecret",
        "credential",
        "credentials"
    ];

    public AuditLogService(AppDbContext db, IHttpContextAccessor httpContextAccessor)
    {
        _db = db;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task RecordAsync(
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
        try
        {
            var httpContext = _httpContextAccessor.HttpContext;
            var claimsPrincipal = httpContext?.User;

            // Auto-resolve User if not explicitly provided
            if (!userId.HasValue && claimsPrincipal?.Identity?.IsAuthenticated == true)
            {
                var userIdStr = claimsPrincipal.FindFirstValue(ClaimTypes.NameIdentifier)
                                ?? claimsPrincipal.FindFirstValue("sub");
                if (Guid.TryParse(userIdStr, out var parsedId))
                {
                    userId = parsedId;
                }
            }

            if (string.IsNullOrWhiteSpace(userName) && claimsPrincipal?.Identity?.IsAuthenticated == true)
            {
                userName = claimsPrincipal.FindFirstValue(ClaimTypes.Name)
                           ?? claimsPrincipal.FindFirstValue("name")
                           ?? claimsPrincipal.Identity.Name;
            }

            if (string.IsNullOrWhiteSpace(userRole) && claimsPrincipal?.Identity?.IsAuthenticated == true)
            {
                userRole = claimsPrincipal.FindFirstValue(ClaimTypes.Role)
                           ?? claimsPrincipal.FindFirstValue("role");
            }

            // Extract IP safely without throwing if unavailable
            string? ipAddress = null;
            try
            {
                ipAddress = httpContext?.Connection?.RemoteIpAddress?.ToString();
            }
            catch
            {
                // Ignore IP resolution issues in testing/disconnected environments
            }

            var sanitizedOldValues = SanitizeJson(oldValues);
            var sanitizedNewValues = SanitizeJson(newValues);
            var sanitizedMetadata = SanitizeJson(metadata);
            var sanitizedDescription = SanitizePlainText(description);

            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                TimestampUtc = DateTime.UtcNow,
                UserId = userId,
                UserName = userName,
                UserRole = userRole,
                Action = action,
                Module = module,
                EntityType = entityType,
                EntityId = entityId,
                EntityReference = entityReference,
                Description = sanitizedDescription,
                OldValues = sanitizedOldValues,
                NewValues = sanitizedNewValues,
                Metadata = sanitizedMetadata,
                IpAddress = ipAddress,
                Outcome = outcome,
                CreatedAt = DateTime.UtcNow
            };

            _db.AuditLogs.Add(auditLog);
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Failed to record audit log for action '{Action}' in module '{Module}'", action, module);
            // Re-throw if inside an active database transaction to maintain transaction integrity
            if (_db.Database.CurrentTransaction != null)
            {
                throw;
            }
        }
    }

    public async Task<PagedResult<AuditLogDto>> GetLogsAsync(
        AuditLogQueryParameters query,
        CancellationToken cancellationToken = default)
    {
        var dbQuery = _db.AuditLogs.AsNoTracking().AsQueryable();

        if (query.FromDate.HasValue)
        {
            var fromUtc = DateTime.SpecifyKind(query.FromDate.Value.Date, DateTimeKind.Utc);
            dbQuery = dbQuery.Where(a => a.TimestampUtc >= fromUtc);
        }

        if (query.ToDate.HasValue)
        {
            var toUtc = DateTime.SpecifyKind(query.ToDate.Value.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
            dbQuery = dbQuery.Where(a => a.TimestampUtc <= toUtc);
        }

        if (query.UserId.HasValue)
        {
            dbQuery = dbQuery.Where(a => a.UserId == query.UserId.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Module))
        {
            dbQuery = dbQuery.Where(a => a.Module.ToLower() == query.Module.Trim().ToLower());
        }

        if (!string.IsNullOrWhiteSpace(query.Action))
        {
            dbQuery = dbQuery.Where(a => a.Action.ToLower() == query.Action.Trim().ToLower());
        }

        if (!string.IsNullOrWhiteSpace(query.EntityType))
        {
            dbQuery = dbQuery.Where(a => a.EntityType != null && a.EntityType.ToLower() == query.EntityType.Trim().ToLower());
        }

        if (!string.IsNullOrWhiteSpace(query.Outcome))
        {
            dbQuery = dbQuery.Where(a => a.Outcome.ToLower() == query.Outcome.Trim().ToLower());
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            dbQuery = dbQuery.Where(a =>
                (a.UserName != null && a.UserName.ToLower().Contains(search))
                || a.Action.ToLower().Contains(search)
                || a.Module.ToLower().Contains(search)
                || a.Description.ToLower().Contains(search)
                || (a.EntityReference != null && a.EntityReference.ToLower().Contains(search)));
        }

        var totalCount = await dbQuery.CountAsync(cancellationToken);

        var pageSize = Math.Clamp(query.PageSize, 1, 200);
        var page = Math.Max(1, query.Page);

        var items = await dbQuery
            .OrderByDescending(a => a.TimestampUtc)
            .ThenByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogDto
            {
                Id = a.Id,
                TimestampUtc = a.TimestampUtc,
                UserId = a.UserId,
                UserName = a.UserName,
                UserRole = a.UserRole,
                Action = a.Action,
                Module = a.Module,
                EntityType = a.EntityType,
                EntityId = a.EntityId,
                EntityReference = a.EntityReference,
                Description = a.Description,
                OldValues = a.OldValues,
                NewValues = a.NewValues,
                Metadata = a.Metadata,
                IpAddress = a.IpAddress,
                Outcome = a.Outcome,
                CreatedAt = a.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<AuditLogDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    private static string? SanitizeJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return json;

        try
        {
            var node = JsonNode.Parse(json);
            if (node == null) return json;

            SanitizeJsonNode(node);
            return node.ToJsonString();
        }
        catch
        {
            return SanitizePlainText(json);
        }
    }

    private static void SanitizeJsonNode(JsonNode node)
    {
        if (node is JsonObject obj)
        {
            var keys = obj.Select(kvp => kvp.Key).ToList();
            foreach (var key in keys)
            {
                var lowerKey = key.ToLowerInvariant();
                if (SensitiveKeywords.Any(k => lowerKey.Contains(k)))
                {
                    obj[key] = "[REDACTED]";
                }
                else if (obj[key] != null)
                {
                    SanitizeJsonNode(obj[key]!);
                }
            }
        }
        else if (node is JsonArray arr)
        {
            foreach (var item in arr)
            {
                if (item != null)
                {
                    SanitizeJsonNode(item);
                }
            }
        }
    }

    private static string SanitizePlainText(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return text;

        var result = text;
        foreach (var keyword in SensitiveKeywords)
        {
            var pattern = $@"(?i)\b{keyword}\s*[:=]\s*([^\s,;]+)";
            result = System.Text.RegularExpressions.Regex.Replace(result, pattern, $"{keyword}=[REDACTED]");
        }
        return result;
    }
}
