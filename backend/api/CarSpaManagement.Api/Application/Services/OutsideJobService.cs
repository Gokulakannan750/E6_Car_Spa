using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs.OutsideJobs;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

public class OutsideJobService : IOutsideJobService
{
    private readonly AppDbContext _db;
    private readonly IAuditLogService _auditLogService;

    public OutsideJobService(AppDbContext db, IAuditLogService auditLogService)
    {
        _db = db;
        _auditLogService = auditLogService;
    }

    public async Task<OutsideJobDto> CreateOutsideJobAsync(
        Guid jobCardId,
        CreateOutsideJobRequest request,
        Guid? userId = null,
        string? userName = null,
        CancellationToken cancellationToken = default)
    {
        var jobCard = await _db.JobCards
            .Include(j => j.Vehicle)
            .Include(j => j.Customer)
            .FirstOrDefaultAsync(j => j.Id == jobCardId && !j.IsDeleted, cancellationToken);

        if (jobCard == null)
            throw new KeyNotFoundException($"Job Card with ID '{jobCardId}' not found.");

        if (jobCard.Status == JobCardStatus.Cancelled)
            throw new InvalidOperationException("Cannot send a vehicle outside for a cancelled job card.");

        if (jobCard.Status == JobCardStatus.Invoiced ||
            jobCard.Status == JobCardStatus.Paid ||
            jobCard.Status == JobCardStatus.Delivered)
        {
            throw new ConflictException("This job card is locked because an invoice has already been generated. New outside jobs cannot be added.");
        }

        var isInvoiceGenerated = await _db.Invoices.AnyAsync(
            i => i.JobCardId == jobCardId &&
                 !i.IsDeleted &&
                 (!string.IsNullOrEmpty(i.InvoiceNumber) || i.Status != InvoiceStatus.Draft),
            cancellationToken);

        if (isInvoiceGenerated)
        {
            throw new ConflictException("This job card is locked because an invoice has already been generated. New outside jobs cannot be added.");
        }

        var vendor = await _db.Vendors
            .FirstOrDefaultAsync(v => v.Id == request.VendorId && !v.IsDeleted, cancellationToken);

        if (vendor == null)
            throw new KeyNotFoundException($"Vendor with ID '{request.VendorId}' not found.");

        if (!vendor.IsActive)
            throw new InvalidOperationException($"Vendor '{vendor.Name}' is inactive.");

        // Rule 12: Do not allow the same vehicle to have multiple active OUTSIDE jobs simultaneously!
        var existingActiveOutsideJob = await _db.OutsideJobs
            .Include(o => o.Vendor)
            .FirstOrDefaultAsync(o => o.VehicleId == jobCard.VehicleId && o.Status == OutsideJobStatus.Outside && !o.IsDeleted, cancellationToken);

        if (existingActiveOutsideJob != null)
        {
            throw new ConflictException(
                $"Vehicle '{jobCard.Vehicle.RegistrationNumber}' is currently outside at '{existingActiveOutsideJob.Vendor.Name}' for '{existingActiveOutsideJob.ServiceName}'. It must be marked returned before sending it outside again.");
        }

        var now = DateTime.UtcNow;
        var sentAt = request.SentAt ?? now;
        var expectedReturnAt = request.ExpectedReturnAt ?? sentAt.AddDays(1);

        Guid? sentByUserId = userId;
        string? sentByUserName = userName;

        if (!string.IsNullOrWhiteSpace(request.SentByType))
        {
            if (request.SentByType.Equals("Owner", StringComparison.OrdinalIgnoreCase))
            {
                sentByUserName = "Owner";
            }
            else if (request.SentByType.Equals("Staff", StringComparison.OrdinalIgnoreCase))
            {
                if (request.SentByStaffId.HasValue)
                {
                    sentByUserId = request.SentByStaffId.Value;
                }
                sentByUserName = !string.IsNullOrWhiteSpace(request.SentByStaffName)
                    ? $"Staff: {request.SentByStaffName.Trim()}"
                    : "Staff";
            }
        }
        else if (request.SentByStaffId.HasValue)
        {
            sentByUserId = request.SentByStaffId.Value;
            sentByUserName = !string.IsNullOrWhiteSpace(request.SentByStaffName)
                ? $"Staff: {request.SentByStaffName.Trim()}"
                : "Staff";
        }

        var outsideJob = new OutsideJob
        {
            Id = Guid.NewGuid(),
            JobCardId = jobCard.Id,
            VehicleId = jobCard.VehicleId,
            CustomerId = jobCard.CustomerId,
            VendorId = vendor.Id,
            ServiceId = request.ServiceId,
            ServiceName = request.ServiceName.Trim(),
            Status = OutsideJobStatus.Outside,
            SentAt = sentAt,
            ExpectedReturnAt = expectedReturnAt,
            SentByUserId = sentByUserId,
            SentByUserName = sentByUserName,
            VendorCost = request.VendorCost,
            Notes = request.Notes?.Trim(),
            CreatedAt = now,
            UpdatedAt = now,
            IsDeleted = false
        };

        _db.OutsideJobs.Add(outsideJob);
        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: "outsidejobs.send",
            module: "OutsideJobs",
            description: $"Vehicle '{jobCard.Vehicle.RegistrationNumber}' sent outside to '{vendor.Name}' for '{outsideJob.ServiceName}'. Expected return: {outsideJob.ExpectedReturnAt:g}.",
            userId: userId,
            userName: userName,
            entityType: "OutsideJob",
            entityId: outsideJob.Id,
            entityReference: jobCard.JobCardNumber,
            outcome: "Success",
            cancellationToken: cancellationToken);

        return ToDto(outsideJob, jobCard.JobCardNumber, jobCard.Vehicle, jobCard.Customer, vendor);
    }

    public async Task<OutsideJobDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var job = await _db.OutsideJobs
            .Include(o => o.JobCard)
            .Include(o => o.Vehicle)
            .Include(o => o.Customer)
            .Include(o => o.Vendor)
            .FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted, cancellationToken);

        if (job == null) return null;

        return ToDto(job, job.JobCard.JobCardNumber, job.Vehicle, job.Customer, job.Vendor);
    }

    public async Task<IReadOnlyList<OutsideJobDto>> GetByJobCardIdAsync(Guid jobCardId, CancellationToken cancellationToken = default)
    {
        var jobs = await _db.OutsideJobs
            .Include(o => o.JobCard)
            .Include(o => o.Vehicle)
            .Include(o => o.Customer)
            .Include(o => o.Vendor)
            .Where(o => o.JobCardId == jobCardId && !o.IsDeleted)
            .OrderByDescending(o => o.SentAt)
            .ToListAsync(cancellationToken);

        return jobs.Select(j => ToDto(j, j.JobCard.JobCardNumber, j.Vehicle, j.Customer, j.Vendor)).ToList();
    }

    public async Task<OutsideJobListResponse> GetAllAsync(
        int page,
        int pageSize,
        OutsideJobStatus? status = null,
        bool? isOverdue = null,
        Guid? vendorId = null,
        Guid? vehicleId = null,
        string? search = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        CancellationToken cancellationToken = default)
    {
        var query = _db.OutsideJobs
            .Include(o => o.JobCard)
            .Include(o => o.Vehicle)
            .Include(o => o.Customer)
            .Include(o => o.Vendor)
            .Where(o => !o.IsDeleted)
            .AsQueryable();

        if (status.HasValue)
        {
            query = query.Where(o => o.Status == status.Value);
        }

        var now = DateTime.UtcNow;
        if (isOverdue.HasValue)
        {
            if (isOverdue.Value)
            {
                query = query.Where(o => o.Status == OutsideJobStatus.Outside && o.ExpectedReturnAt < now);
            }
            else
            {
                query = query.Where(o => !(o.Status == OutsideJobStatus.Outside && o.ExpectedReturnAt < now));
            }
        }

        if (vendorId.HasValue) query = query.Where(o => o.VendorId == vendorId.Value);
        if (vehicleId.HasValue) query = query.Where(o => o.VehicleId == vehicleId.Value);
        if (fromDate.HasValue) query = query.Where(o => o.SentAt >= fromDate.Value);
        if (toDate.HasValue) query = query.Where(o => o.SentAt < toDate.Value.AddDays(1));

        if (!string.IsNullOrWhiteSpace(search))
        {
            search = search.Trim().ToLower();
            query = query.Where(o =>
                o.JobCard.JobCardNumber.ToLower().Contains(search) ||
                o.Vehicle.RegistrationNumber.ToLower().Contains(search) ||
                o.Customer.Name.ToLower().Contains(search) ||
                o.Customer.PhoneNumber.Contains(search) ||
                o.Vendor.Name.ToLower().Contains(search) ||
                o.ServiceName.ToLower().Contains(search));
        }

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(o => o.SentAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(j => ToDto(j, j.JobCard.JobCardNumber, j.Vehicle, j.Customer, j.Vendor)).ToList();
        return new OutsideJobListResponse(dtos, total, page, pageSize);
    }

    public async Task<OutsideJobDto> MarkReturnedAsync(
        Guid id,
        MarkOutsideJobReturnedRequest request,
        Guid? userId = null,
        string? userName = null,
        CancellationToken cancellationToken = default)
    {
        var job = await _db.OutsideJobs
            .Include(o => o.JobCard)
            .Include(o => o.Vehicle)
            .Include(o => o.Customer)
            .Include(o => o.Vendor)
            .FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted, cancellationToken);

        if (job == null)
            throw new KeyNotFoundException($"Outside job with ID '{id}' not found.");

        if (request.VendorCost.HasValue && request.VendorCost.Value < 0)
            throw new ArgumentOutOfRangeException(nameof(request.VendorCost), "Vendor cost cannot be negative.");

        await EnsureJobCardNotLockedAsync(job.JobCardId, "Outside job cannot be marked returned after invoice generation.", cancellationToken);

        if (job.Status != OutsideJobStatus.Outside)
            throw new InvalidOperationException($"Outside job is in status '{job.Status}' and cannot be marked returned.");

        var now = DateTime.UtcNow;
        job.Status = OutsideJobStatus.Returned;
        job.ReturnedAt = request.ReturnedAt ?? now;
        job.ReturnedByUserId = userId;
        job.ReturnedByUserName = userName;
        if (request.VendorCost.HasValue)
        {
            job.VendorCost = request.VendorCost.Value;
        }
        if (!string.IsNullOrWhiteSpace(request.ReturnNotes))
        {
            job.ReturnNotes = request.ReturnNotes.Trim();
        }
        job.UpdatedAt = now;

        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: "outsidejobs.return",
            module: "OutsideJobs",
            description: $"Vehicle '{job.Vehicle.RegistrationNumber}' marked returned from '{job.Vendor.Name}'.",
            userId: userId,
            userName: userName,
            entityType: "OutsideJob",
            entityId: job.Id,
            entityReference: job.JobCard.JobCardNumber,
            outcome: "Success",
            cancellationToken: cancellationToken);

        return ToDto(job, job.JobCard.JobCardNumber, job.Vehicle, job.Customer, job.Vendor);
    }

    public async Task<OutsideJobDto> CancelAsync(
        Guid id,
        CancelOutsideJobRequest request,
        Guid? userId = null,
        string? userName = null,
        CancellationToken cancellationToken = default)
    {
        var job = await _db.OutsideJobs
            .Include(o => o.JobCard)
            .Include(o => o.Vehicle)
            .Include(o => o.Customer)
            .Include(o => o.Vendor)
            .FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted, cancellationToken);

        if (job == null)
            throw new KeyNotFoundException($"Outside job with ID '{id}' not found.");

        if (job.Status == OutsideJobStatus.Returned)
            throw new InvalidOperationException("Cannot cancel an outside job that has already been marked returned.");

        var now = DateTime.UtcNow;
        job.Status = OutsideJobStatus.Cancelled;
        job.CancellationReason = request.Reason.Trim();
        job.UpdatedAt = now;

        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: "outsidejobs.cancel",
            module: "OutsideJobs",
            description: $"Outside job for vehicle '{job.Vehicle.RegistrationNumber}' at '{job.Vendor.Name}' cancelled. Reason: {request.Reason}.",
            userId: userId,
            userName: userName,
            entityType: "OutsideJob",
            entityId: job.Id,
            entityReference: job.JobCard.JobCardNumber,
            outcome: "Success",
            cancellationToken: cancellationToken);

        return ToDto(job, job.JobCard.JobCardNumber, job.Vehicle, job.Customer, job.Vendor);
    }

    public async Task<OutsideJobDto?> UpdateAsync(
        Guid id,
        UpdateOutsideJobRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.VendorCost.HasValue && request.VendorCost.Value < 0)
            throw new ArgumentOutOfRangeException(nameof(request.VendorCost), "Vendor cost cannot be negative.");

        var job = await _db.OutsideJobs
            .Include(o => o.JobCard)
            .Include(o => o.Vehicle)
            .Include(o => o.Customer)
            .Include(o => o.Vendor)
            .FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted, cancellationToken);

        if (job == null) return null;

        await EnsureJobCardNotLockedAsync(job.JobCardId, "Outside job cannot be updated after invoice generation.", cancellationToken);

        if (job.Status == OutsideJobStatus.Returned || job.Status == OutsideJobStatus.Cancelled)
            throw new InvalidOperationException($"Cannot edit an outside job that is '{job.Status}'.");

        var vendor = await _db.Vendors.FirstOrDefaultAsync(v => v.Id == request.VendorId && !v.IsDeleted, cancellationToken);
        if (vendor == null) throw new KeyNotFoundException("Vendor not found.");

        job.VendorId = vendor.Id;
        job.ServiceName = request.ServiceName.Trim();
        job.ServiceId = request.ServiceId;
        job.ExpectedReturnAt = request.ExpectedReturnAt;
        job.VendorCost = request.VendorCost;
        job.Notes = request.Notes?.Trim();
        job.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: "outsidejobs.edit",
            module: "OutsideJobs",
            description: $"Outside job for vehicle '{job.Vehicle.RegistrationNumber}' updated.",
            entityType: "OutsideJob",
            entityId: job.Id,
            entityReference: job.JobCard.JobCardNumber,
            outcome: "Success",
            cancellationToken: cancellationToken);

        return ToDto(job, job.JobCard.JobCardNumber, job.Vehicle, job.Customer, vendor);
    }

    /// <param name="canModifyDraftInvoice">
    /// Whether the caller holds <c>invoices.edit_draft</c>. When the job is billed on a draft invoice, changing its cost
    /// rewrites that invoice line, so it is refused (<see cref="ForbiddenException"/>) unless this is true.
    /// </param>
    public async Task<OutsideJobDto> UpdateCostAsync(
        Guid id,
        UpdateOutsideJobCostRequest request,
        Guid? userId = null,
        string? userName = null,
        CancellationToken cancellationToken = default,
        bool canModifyDraftInvoice = false)
    {
        if (request.VendorCost < 0)
            throw new ArgumentOutOfRangeException(nameof(request.VendorCost), "Vendor cost cannot be negative.");

        var job = await _db.OutsideJobs
            .Include(o => o.JobCard)
            .Include(o => o.Vehicle)
            .Include(o => o.Customer)
            .Include(o => o.Vendor)
            .FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted, cancellationToken);

        if (job == null)
            throw new KeyNotFoundException($"Outside job with ID '{id}' not found.");

        await EnsureJobCardNotLockedAsync(job.JobCardId, "Vendor cost cannot be modified after invoice generation.", cancellationToken);

        // If there is an existing draft invoice for this job card, update the corresponding invoice item
        var draftInvoice = await _db.Invoices
            .Include(i => i.InvoiceItems)
            .Include(i => i.JobCard).ThenInclude(j => j.JobCardServices)
            .FirstOrDefaultAsync(i => i.JobCardId == job.JobCardId && !i.IsDeleted && i.Status == InvoiceStatus.Draft && string.IsNullOrEmpty(i.InvoiceNumber), cancellationToken);
        var draftItem = draftInvoice?.InvoiceItems.FirstOrDefault(it => it.OutsideJobId == job.Id && !it.IsDeleted);

        // RBAC P1-2: a vendor cost billed on a draft invoice is that invoice's line price.
        if (draftItem != null && draftItem.UnitPrice != InvoiceCalculator.Round(request.VendorCost))
            await EnsureCanModifyDraftInvoiceAsync(canModifyDraftInvoice, job, "change the vendor cost", userId, userName, cancellationToken);

        job.VendorCost = request.VendorCost;
        job.UpdatedAt = DateTime.UtcNow;

        if (draftInvoice != null)
        {
            var item = draftItem;
            if (item != null)
            {
                item.UnitPrice = InvoiceCalculator.Round(request.VendorCost);
                item.UpdatedAt = DateTime.UtcNow;

                InvoiceCalculator.ApplyToInvoice(draftInvoice,
                    await InvoiceTaxRates.ForDraftAsync(_db, draftInvoice, draftInvoice.JobCard?.JobCardServices, cancellationToken));
                draftInvoice.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: "outsidejobs.edit",
            module: "OutsideJobs",
            description: $"Vendor cost for outside job '{job.ServiceName}' on vehicle '{job.Vehicle.RegistrationNumber}' updated to {request.VendorCost:C}.",
            userId: userId,
            userName: userName,
            entityType: "OutsideJob",
            entityId: job.Id,
            entityReference: job.JobCard.JobCardNumber,
            outcome: "Success",
            cancellationToken: cancellationToken);

        return ToDto(job, job.JobCard.JobCardNumber, job.Vehicle, job.Customer, job.Vendor);
    }

    /// <param name="canModifyDraftInvoice">
    /// Whether the caller holds <c>invoices.edit_draft</c>. Deleting a job billed on a draft invoice removes that invoice
    /// line, so it is refused (<see cref="ForbiddenException"/>) unless this is true.
    /// </param>
    public async Task<bool> DeleteAsync(
        Guid id,
        Guid? userId = null,
        string? userName = null,
        CancellationToken cancellationToken = default,
        bool canModifyDraftInvoice = false)
    {
        var job = await _db.OutsideJobs
            .Include(o => o.JobCard)
            .Include(o => o.Vehicle)
            .FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted, cancellationToken);

        if (job == null) return false;

        await EnsureJobCardNotLockedAsync(job.JobCardId, "Outside job movements cannot be deleted after invoice generation.", cancellationToken);

        var isBilledOnGeneratedInvoice = await _db.InvoiceItems.AnyAsync(
            ii => ii.OutsideJobId == id &&
                  !ii.IsDeleted &&
                  ii.Invoice != null &&
                  !ii.Invoice.IsDeleted &&
                  (!string.IsNullOrEmpty(ii.Invoice.InvoiceNumber) || ii.Invoice.Status != InvoiceStatus.Draft),
            cancellationToken);

        if (isBilledOnGeneratedInvoice)
        {
            throw new ConflictException("This movement cannot be deleted because it is part of a generated invoice.");
        }

        var draftInvoice = await _db.Invoices
            .Include(i => i.InvoiceItems)
            .Include(i => i.JobCard).ThenInclude(j => j.JobCardServices)
            .FirstOrDefaultAsync(i => i.JobCardId == job.JobCardId && !i.IsDeleted && i.Status == InvoiceStatus.Draft && string.IsNullOrEmpty(i.InvoiceNumber), cancellationToken);
        var draftItem = draftInvoice?.InvoiceItems.FirstOrDefault(it => it.OutsideJobId == job.Id && !it.IsDeleted);

        // RBAC P1-2: removing a job billed on a draft invoice removes that invoice line.
        if (draftItem != null)
            await EnsureCanModifyDraftInvoiceAsync(canModifyDraftInvoice, job, "delete the outside job", userId, userName, cancellationToken);

        job.IsDeleted = true;
        job.UpdatedAt = DateTime.UtcNow;

        if (draftInvoice != null)
        {
            var item = draftItem;
            if (item != null)
            {
                item.IsDeleted = true;
                item.UpdatedAt = DateTime.UtcNow;

                InvoiceCalculator.ApplyToInvoice(draftInvoice,
                    await InvoiceTaxRates.ForDraftAsync(_db, draftInvoice, draftInvoice.JobCard?.JobCardServices, cancellationToken));
                draftInvoice.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _db.SaveChangesAsync(cancellationToken);

        await _auditLogService.RecordAsync(
            action: "outsidejobs.delete",
            module: "OutsideJobs",
            description: $"Outside job '{job.ServiceName}' for vehicle '{job.Vehicle.RegistrationNumber}' deleted/marked obsolete.",
            userId: userId,
            userName: userName,
            entityType: "OutsideJob",
            entityId: job.Id,
            entityReference: job.JobCard.JobCardNumber,
            outcome: "Success",
            cancellationToken: cancellationToken);

        return true;
    }

    private async Task EnsureJobCardNotLockedAsync(Guid jobCardId, string actionDescription, CancellationToken cancellationToken)
    {
        var jobCard = await _db.JobCards.FirstOrDefaultAsync(j => j.Id == jobCardId && !j.IsDeleted, cancellationToken);
        if (jobCard == null)
            throw new KeyNotFoundException($"Job Card with ID '{jobCardId}' not found.");

        if (jobCard.Status == JobCardStatus.Invoiced ||
            jobCard.Status == JobCardStatus.Paid ||
            jobCard.Status == JobCardStatus.Delivered)
        {
            throw new ConflictException($"This job card is locked because an invoice has already been generated. {actionDescription}");
        }

        var isInvoiceGenerated = await _db.Invoices.AnyAsync(
            i => i.JobCardId == jobCardId &&
                 !i.IsDeleted &&
                 (!string.IsNullOrEmpty(i.InvoiceNumber) || i.Status != InvoiceStatus.Draft),
            cancellationToken);

        if (isInvoiceGenerated)
        {
            throw new ConflictException($"This job card is locked because an invoice has already been generated. {actionDescription}");
        }
    }

    /// <summary>
    /// Refuses (and audits) an outside-job change that would alter a draft invoice when the caller may not edit drafts.
    /// </summary>
    private async Task EnsureCanModifyDraftInvoiceAsync(bool canModifyDraftInvoice, OutsideJob job, string attemptedAction, Guid? userId, string? userName, CancellationToken cancellationToken)
    {
        if (canModifyDraftInvoice) return;

        await _auditLogService.RecordAsync(
            action: "outsidejobs.draft_invoice_change_denied",
            module: "OutsideJobs",
            description: $"Denied: attempted to {attemptedAction} for '{job.ServiceName}' on a job card with a draft invoice, without permission to edit draft invoices.",
            userId: userId,
            userName: userName,
            entityType: "OutsideJob",
            entityId: job.Id,
            entityReference: job.JobCard?.JobCardNumber,
            outcome: "Denied",
            cancellationToken: cancellationToken);

        throw new ForbiddenException("This outside job is billed on a draft invoice. Changing it requires permission to edit draft invoices (invoices.edit_draft).");
    }

    public async Task<VehicleLocationDto> GetVehicleLocationByJobCardIdAsync(Guid jobCardId, CancellationToken cancellationToken = default)
    {
        var activeJob = await _db.OutsideJobs
            .Include(o => o.Vendor)
            .FirstOrDefaultAsync(o => o.JobCardId == jobCardId && o.Status == OutsideJobStatus.Outside && !o.IsDeleted, cancellationToken);

        return BuildVehicleLocationDto(activeJob);
    }

    public async Task<VehicleLocationDto> GetVehicleLocationByVehicleIdAsync(Guid vehicleId, CancellationToken cancellationToken = default)
    {
        var activeJob = await _db.OutsideJobs
            .Include(o => o.Vendor)
            .FirstOrDefaultAsync(o => o.VehicleId == vehicleId && o.Status == OutsideJobStatus.Outside && !o.IsDeleted, cancellationToken);

        return BuildVehicleLocationDto(activeJob);
    }

    private static VehicleLocationDto BuildVehicleLocationDto(OutsideJob? activeJob)
    {
        if (activeJob == null)
        {
            return new VehicleLocationDto(
                Location: "At Showroom",
                IsOutside: false,
                ActiveOutsideJobId: null,
                VendorId: null,
                VendorName: null,
                ServiceName: null,
                SentAt: null,
                ExpectedReturnAt: null,
                IsOverdue: false);
        }

        var isOverdue = DateTime.UtcNow > activeJob.ExpectedReturnAt;
        return new VehicleLocationDto(
            Location: "At Outside Shop",
            IsOutside: true,
            ActiveOutsideJobId: activeJob.Id,
            VendorId: activeJob.VendorId,
            VendorName: activeJob.Vendor?.Name ?? string.Empty,
            ServiceName: activeJob.ServiceName,
            SentAt: activeJob.SentAt,
            ExpectedReturnAt: activeJob.ExpectedReturnAt,
            IsOverdue: isOverdue);
    }

    private static OutsideJobDto ToDto(OutsideJob j, string jobCardNumber, Vehicle v, Customer c, Vendor vendor)
    {
        var isOverdue = j.Status == OutsideJobStatus.Outside && DateTime.UtcNow > j.ExpectedReturnAt;
        return new OutsideJobDto(
            Id: j.Id,
            JobCardId: j.JobCardId,
            JobCardNumber: jobCardNumber,
            VehicleId: j.VehicleId,
            VehicleRegistrationNumber: v.RegistrationNumber,
            VehicleMake: v.Make,
            VehicleModel: v.Model,
            CustomerId: j.CustomerId,
            CustomerName: c.Name,
            CustomerPhone: c.PhoneNumber,
            VendorId: j.VendorId,
            VendorName: vendor.Name,
            VendorPhone: vendor.Phone,
            ServiceId: j.ServiceId,
            ServiceName: j.ServiceName,
            Status: j.Status,
            StatusName: j.Status.ToString(),
            SentAt: j.SentAt,
            ExpectedReturnAt: j.ExpectedReturnAt,
            ReturnedAt: j.ReturnedAt,
            IsOverdue: isOverdue,
            SentByUserId: j.SentByUserId,
            SentByUserName: j.SentByUserName,
            ReturnedByUserId: j.ReturnedByUserId,
            ReturnedByUserName: j.ReturnedByUserName,
            VendorCost: j.VendorCost,
            Notes: j.Notes,
            ReturnNotes: j.ReturnNotes,
            CancellationReason: j.CancellationReason,
            CreatedAt: j.CreatedAt,
            UpdatedAt: j.UpdatedAt);
    }
}
