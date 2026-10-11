using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.Reports;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

/// <summary>
/// Gives a franchisor the franchisee's own reports, but only for what the franchisee has allowed. The approval is
/// checked twice: here against the link, and by the database (<c>franchise_has_scope</c>) against the franchisor's
/// signed-in company. The report itself is produced by the same code the franchisee uses, on a read-only view of
/// the franchisee's data that exists only for this one call.
/// </summary>
public class FranchiseReportService(
    AppDbContext db,
    DbContextOptions<AppDbContext> options,
    IFranchiseEntitlement entitlement,
    IAuditLogService auditLogService) : IFranchiseReports
{
    public async Task<MonthlyBillingReportResponse> GetMonthlyBillingReportAsync(
        Guid linkId, int year, int month, CancellationToken cancellationToken = default)
    {
        if (year < 2000 || year > 2100 || month < 1 || month > 12)
        {
            throw new ValidationException("Choose a valid month.");
        }
        if (!await entitlement.IsEnabledAsync(cancellationToken))
        {
            throw new ForbiddenException("The Franchise add-on is not active for your company.");
        }

        var me = db.CurrentOrganizationId;
        var link = await db.FranchiseLinks.Include(l => l.Scopes)
            .FirstOrDefaultAsync(l => l.Id == linkId && l.FranchisorOrganizationId == me, cancellationToken)
            ?? throw new NotFoundException("Franchise link not found.");

        if (link.Status != FranchiseLinkStatus.Active)
        {
            throw new ConflictException("This franchise link is not active.");
        }
        if (!link.Scopes.Any(s => s.Scope == FranchiseScopes.InvoiceList && s.Status == FranchiseScopeStatus.Granted))
        {
            throw new ForbiddenException("This company has not allowed you to see its invoice list.");
        }

        var approvedByDatabase = await db.Database
            .SqlQuery<bool>($"SELECT franchise_has_scope({link.FranchiseeOrganizationId}, {FranchiseScopes.InvoiceList}) AS \"Value\"")
            .SingleAsync(cancellationToken);
        if (!approvedByDatabase)
        {
            throw new ForbiddenException("This company has not allowed you to see its invoice list.");
        }

        await using var view = AppDbContext.ForReadOnly(options, new FixedTenantContext(link.FranchiseeOrganizationId));
        var report = await new ReportService(view).GetMonthlyBillingReportAsync(year, month, null, null, cancellationToken);

        await auditLogService.RecordAsync(
            action: "franchise.billing_report_viewed",
            module: AuditModules.Franchise,
            description: $"Downloaded a franchisee's monthly billing report for {report.MonthName}.",
            entityType: nameof(FranchiseLink),
            entityId: link.Id,
            cancellationToken: cancellationToken);

        return report;
    }
}
