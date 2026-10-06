using System.Text.Json;
using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Application.DTOs;
using CarSpaManagement.Api.Application.DTOs.Audit;
using CarSpaManagement.Api.Application.DTOs.Invoices;
using CarSpaManagement.Api.Application.DTOs.OutsideJobs;
using CarSpaManagement.Api.Application.DTOs.Showrooms;
using CarSpaManagement.Api.Application.Interfaces;
using CarSpaManagement.Api.Application.Services;
using CarSpaManagement.Api.Domain.Constants;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using CarSpaManagement.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace CarSpaManagement.Api.Tests;

/// <summary>
/// RBAC Phase 1 (backend) — service-level checks:
/// P1-2 outside-job changes that alter a draft invoice need invoices.edit_draft; P1-4 showroom mutations are audited
/// with old/new state; P1-5 role and permission changes are both recorded. P1-1 lives in ManagerPrivilegeEscalationTests;
/// HTTP enforcement and the grant migration are in RbacPhase1HttpTests.
/// </summary>
public class RbacPhase1SecurityTests
{
    /// <summary>Audit double that keeps the full entry, including old/new values.</summary>
    internal sealed class CapturingAuditLogService : IAuditLogService
    {
        public sealed record Entry(string Action, string Module, string Description, Guid? EntityId, string? OldValues, string? NewValues, string Outcome);

        public List<Entry> Entries { get; } = new();

        public Task RecordAsync(string action, string module, string description, Guid? userId = null, string? userName = null,
            string? userRole = null, string? entityType = null, Guid? entityId = null, string? entityReference = null,
            string? oldValues = null, string? newValues = null, string? metadata = null, string outcome = "Success",
            CancellationToken cancellationToken = default)
        {
            Entries.Add(new Entry(action, module, description, entityId, oldValues, newValues, outcome));
            return Task.CompletedTask;
        }

        public Task<PagedResult<AuditLogDto>> GetLogsAsync(AuditLogQueryParameters query, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public Entry Single(string action) => Assert.Single(Entries, e => e.Action == action);
    }

    private static AppDbContext NewDb() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
        .Options);

    private static JsonElement Json(string? json) => JsonDocument.Parse(json!).RootElement;

    // ── P1-2: outside-job cost / delete on a draft invoice ──────────────────

    private sealed record OutsideJobEnv(AppDbContext Db, OutsideJobService OutsideJobs, InvoiceService Invoices, CapturingAuditLogService Audit);

    private static OutsideJobEnv CreateOutsideJobEnv()
    {
        var db = NewDb();
        var audit = new CapturingAuditLogService();
        var invoices = new InvoiceService(db, audit, new ConfigurationBuilder().Build(), new HttpContextAccessor(),
            new NoopWhatsAppService(), new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>());
        return new OutsideJobEnv(db, new OutsideJobService(db, audit), invoices, audit);
    }

    /// <summary>A job card with one returned outside job at ₹1,000; optionally with a draft invoice that bills it.</summary>
    private static async Task<(OutsideJob Job, Invoice? Draft)> SeedReturnedOutsideJobAsync(OutsideJobEnv env, bool withDraftInvoice)
    {
        var customer = new Customer { Name = "RBAC Customer", PhoneNumber = "9000000123" };
        var vehicle = new Vehicle { CustomerId = customer.Id, RegistrationNumber = $"TN01RB{Random.Shared.Next(1000, 9999)}", Make = "Tata", Model = "Nexon" };
        var vendor = new Vendor { Name = "RBAC Vendor", Phone = "9000000124", IsActive = true };
        var jobCard = new JobCard { JobCardNumber = $"JC-RBAC-{Guid.NewGuid():N}"[..20], CustomerId = customer.Id, VehicleId = vehicle.Id, Status = JobCardStatus.Draft };
        var job = new OutsideJob
        {
            JobCardId = jobCard.Id, VehicleId = vehicle.Id, CustomerId = customer.Id, VendorId = vendor.Id,
            ServiceName = "Denting", Status = OutsideJobStatus.Returned, SentAt = DateTime.UtcNow.AddDays(-2),
            ExpectedReturnAt = DateTime.UtcNow.AddDays(-1), ReturnedAt = DateTime.UtcNow, VendorCost = 1000m,
        };
        env.Db.AddRange(customer, vehicle, vendor, jobCard, job);
        await env.Db.SaveChangesAsync();

        Invoice? draft = null;
        if (withDraftInvoice)
        {
            var dto = await env.Invoices.CreateFromJobCardAsync(new CreateInvoiceFromJobCardRequest(jobCard.Id));
            draft = await env.Db.Invoices.Include(i => i.InvoiceItems).SingleAsync(i => i.Id == dto.Id);
            Assert.Contains(draft.InvoiceItems, it => it.OutsideJobId == job.Id && it.UnitPrice == 1000m);
        }
        return (job, draft);
    }

    private static async Task<(decimal LinePrice, bool LineDeleted, decimal Total)> DraftStateAsync(OutsideJobEnv env, Guid invoiceId, Guid jobId)
    {
        var invoice = await env.Db.Invoices.IgnoreQueryFilters().AsNoTracking().Include(i => i.InvoiceItems).SingleAsync(i => i.Id == invoiceId);
        var line = invoice.InvoiceItems.Single(it => it.OutsideJobId == jobId);
        return (line.UnitPrice, line.IsDeleted, invoice.TotalAmount);
    }

    [Fact]
    public async Task P1_2_CostChange_OnDraftInvoice_WithoutEditDraft_IsRefusedAndAudited_AndNothingChanges()
    {
        var env = CreateOutsideJobEnv();
        var (job, draft) = await SeedReturnedOutsideJobAsync(env, withDraftInvoice: true);
        var before = await DraftStateAsync(env, draft!.Id, job.Id);

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            env.OutsideJobs.UpdateCostAsync(job.Id, new UpdateOutsideJobCostRequest(2500m), canModifyDraftInvoice: false));

        Assert.Contains("invoices.edit_draft", ex.Message);
        env.Db.ChangeTracker.Clear();
        Assert.Equal(1000m, (await env.Db.OutsideJobs.AsNoTracking().SingleAsync(o => o.Id == job.Id)).VendorCost);
        Assert.Equal(before, await DraftStateAsync(env, draft.Id, job.Id));
        Assert.Equal("Denied", env.Audit.Single("outsidejobs.draft_invoice_change_denied").Outcome);
        Assert.DoesNotContain(env.Audit.Entries, e => e.Action == "outsidejobs.edit");
    }

    [Fact]
    public async Task P1_2_CostChange_OnDraftInvoice_WithEditDraft_UpdatesLineAndTotal_AndIsAudited()
    {
        var env = CreateOutsideJobEnv();
        var (job, draft) = await SeedReturnedOutsideJobAsync(env, withDraftInvoice: true);

        await env.OutsideJobs.UpdateCostAsync(job.Id, new UpdateOutsideJobCostRequest(2500m), canModifyDraftInvoice: true);

        var after = await DraftStateAsync(env, draft!.Id, job.Id);
        Assert.Equal(2500m, after.LinePrice);
        Assert.Equal(2500m, after.Total); // the seeded draft has no GST service lines, so it is a non-GST invoice
        Assert.Equal("Success", env.Audit.Single("outsidejobs.edit").Outcome);
    }

    [Fact]
    public async Task P1_2_CostChange_WithoutDraftInvoice_NeedsOnlyOutsideJobRights()
    {
        var env = CreateOutsideJobEnv();
        var (job, _) = await SeedReturnedOutsideJobAsync(env, withDraftInvoice: false);

        var dto = await env.OutsideJobs.UpdateCostAsync(job.Id, new UpdateOutsideJobCostRequest(1800m), canModifyDraftInvoice: false);

        Assert.Equal(1800m, dto.VendorCost);
        Assert.Contains(env.Audit.Entries, e => e.Action == "outsidejobs.edit" && e.Outcome == "Success");
    }

    [Fact]
    public async Task P1_2_CostChange_ToTheSameBilledAmount_DoesNotNeedEditDraft()
    {
        var env = CreateOutsideJobEnv();
        var (job, draft) = await SeedReturnedOutsideJobAsync(env, withDraftInvoice: true);

        await env.OutsideJobs.UpdateCostAsync(job.Id, new UpdateOutsideJobCostRequest(1000m), canModifyDraftInvoice: false);

        Assert.Equal(1000m, (await DraftStateAsync(env, draft!.Id, job.Id)).LinePrice);
    }

    [Fact]
    public async Task P1_2_Delete_OfJobBilledOnDraft_RequiresEditDraft()
    {
        var env = CreateOutsideJobEnv();
        var (job, draft) = await SeedReturnedOutsideJobAsync(env, withDraftInvoice: true);

        await Assert.ThrowsAsync<ForbiddenException>(() => env.OutsideJobs.DeleteAsync(job.Id, canModifyDraftInvoice: false));
        env.Db.ChangeTracker.Clear();
        Assert.False((await env.Db.OutsideJobs.IgnoreQueryFilters().AsNoTracking().SingleAsync(o => o.Id == job.Id)).IsDeleted);
        Assert.False((await DraftStateAsync(env, draft!.Id, job.Id)).LineDeleted);

        Assert.True(await env.OutsideJobs.DeleteAsync(job.Id, canModifyDraftInvoice: true));
        var after = await DraftStateAsync(env, draft.Id, job.Id);
        Assert.True(after.LineDeleted);
        Assert.Equal(0m, after.Total);
    }

    [Fact]
    public async Task P1_2_Delete_WithoutDraftInvoice_NeedsOnlyOutsideJobRights()
    {
        var env = CreateOutsideJobEnv();
        var (job, _) = await SeedReturnedOutsideJobAsync(env, withDraftInvoice: false);
        Assert.True(await env.OutsideJobs.DeleteAsync(job.Id, canModifyDraftInvoice: false));
    }

    // ── P1-4: showroom audit ────────────────────────────────────────────────

    private sealed record ShowroomEnv(AppDbContext Db, ShowroomService Showrooms, CapturingAuditLogService Audit, Staff Staff);

    private static async Task<ShowroomEnv> CreateShowroomEnvAsync()
    {
        var db = NewDb();
        var audit = new CapturingAuditLogService();
        var staff = new Staff { Name = "Ravi", PhoneNumber = "9000000200", StaffMasterId = "RV001A", IsActive = true };
        db.Staff.Add(staff);
        await db.SaveChangesAsync();
        return new ShowroomEnv(db, new ShowroomService(db, audit), audit, staff);
    }

    [Fact]
    public async Task P1_4_ShowroomCreate_Update_ActivateDeactivate_AreAudited_WithOldAndNewState()
    {
        var env = await CreateShowroomEnvAsync();

        var created = await env.Showrooms.CreateAsync(new CreateShowroomRequest { Name = "Lakshmi Hyundai", Address = "Perundurai Road", IsActive = true });
        var create = env.Audit.Single("showroom.create");
        Assert.Equal(created.Id, create.EntityId);
        Assert.Equal("Lakshmi Hyundai", Json(create.NewValues).GetProperty("Name").GetString());

        await env.Showrooms.UpdateAsync(created.Id, new UpdateShowroomRequest { Name = "Lakshmi Hyundai Erode", IsActive = false });
        var update = env.Audit.Single("showroom.update");
        Assert.Equal("Lakshmi Hyundai", Json(update.OldValues).GetProperty("Name").GetString());
        Assert.Equal("Lakshmi Hyundai Erode", Json(update.NewValues).GetProperty("Name").GetString());
        Assert.True(Json(update.OldValues).GetProperty("IsActive").GetBoolean());
        Assert.False(Json(update.NewValues).GetProperty("IsActive").GetBoolean());

        Assert.True(await env.Showrooms.ToggleActiveAsync(created.Id));
        var activate = env.Audit.Single("showroom.activate");
        Assert.False(Json(activate.OldValues).GetProperty("isActive").GetBoolean());
        Assert.True(Json(activate.NewValues).GetProperty("isActive").GetBoolean());

        Assert.True(await env.Showrooms.ToggleActiveAsync(created.Id));
        var deactivate = env.Audit.Single("showroom.deactivate");
        Assert.True(Json(deactivate.OldValues).GetProperty("isActive").GetBoolean());
        Assert.False(Json(deactivate.NewValues).GetProperty("isActive").GetBoolean());
    }

    [Fact]
    public async Task P1_4_StaffAssignment_Create_Update_Remove_AreAudited_WithShowroomDateStaffAndState()
    {
        var env = await CreateShowroomEnvAsync();
        var showroom = await env.Showrooms.CreateAsync(new CreateShowroomRequest { Name = "Kia Erode", Address = "Erode", IsActive = true });
        var date = new DateTime(2026, 10, 6);

        var assigned = await env.Showrooms.AssignStaffAsync(showroom.Id, new CreateDailyStaffAssignmentRequest { StaffId = env.Staff.Id, Date = date, VehiclesAttended = 3 });
        var create = env.Audit.Single("showroom.assign_staff");
        var created = Json(create.NewValues);
        Assert.Equal(showroom.Id, created.GetProperty("showroomId").GetGuid());
        Assert.Equal("2026-10-06", created.GetProperty("date").GetString());
        Assert.Equal(env.Staff.Id, created.GetProperty("staffId").GetGuid());
        Assert.Equal(3, created.GetProperty("vehiclesAttended").GetInt32());

        await env.Showrooms.UpdateAssignmentAsync(assigned.Id, new UpdateDailyStaffAssignmentRequest { VehiclesAttended = 7, StartTime = "10:00", EndTime = "17:00" });
        var update = env.Audit.Single("showroom.update_assignment");
        Assert.Equal(3, Json(update.OldValues).GetProperty("vehiclesAttended").GetInt32());
        Assert.Equal(7, Json(update.NewValues).GetProperty("vehiclesAttended").GetInt32());
        Assert.Equal("09:00", Json(update.OldValues).GetProperty("startTime").GetString());
        Assert.Equal("10:00", Json(update.NewValues).GetProperty("startTime").GetString());
        Assert.Equal("Ravi", Json(update.NewValues).GetProperty("staff").GetString());

        Assert.True(await env.Showrooms.RemoveAssignmentAsync(assigned.Id));
        var remove = env.Audit.Single("showroom.remove_assignment");
        var removed = Json(remove.OldValues);
        Assert.Equal(showroom.Id, removed.GetProperty("showroomId").GetGuid());
        Assert.Equal("Kia Erode", removed.GetProperty("showroom").GetString());
        Assert.Equal(env.Staff.Id, removed.GetProperty("staffId").GetGuid());
        Assert.Equal(7, removed.GetProperty("vehiclesAttended").GetInt32());
        Assert.True(Json(remove.NewValues).GetProperty("removed").GetBoolean());
    }

    [Fact]
    public async Task P1_4_DailyBill_SetAndChange_AreAudited_WithShowroomDatePreviousAndNewAmount()
    {
        var env = await CreateShowroomEnvAsync();
        var showroom = await env.Showrooms.CreateAsync(new CreateShowroomRequest { Name = "Maruti Arena", Address = "Erode", IsActive = true });
        var date = new DateTime(2026, 10, 6);

        await env.Showrooms.SetDailyBillAsync(showroom.Id, date, new SetShowroomDailyBillRequest { Amount = 1000m });
        await env.Showrooms.SetDailyBillAsync(showroom.Id, date, new SetShowroomDailyBillRequest { Amount = 1500m, Notes = "Extra car" });

        var entries = env.Audit.Entries.Where(e => e.Action == "showroom.set_daily_bill").ToList();
        Assert.Equal(2, entries.Count);

        var first = Json(entries[0].OldValues);
        Assert.Equal(JsonValueKind.Null, first.GetProperty("amount").ValueKind);
        Assert.Equal(1000m, Json(entries[0].NewValues).GetProperty("amount").GetDecimal());

        var change = entries[1];
        Assert.Equal(showroom.Id, Json(change.NewValues).GetProperty("showroomId").GetGuid());
        Assert.Equal("2026-10-06", Json(change.NewValues).GetProperty("date").GetString());
        Assert.Equal(1000m, Json(change.OldValues).GetProperty("amount").GetDecimal());
        Assert.Equal(1500m, Json(change.NewValues).GetProperty("amount").GetDecimal());
        Assert.Contains("from ₹1000.00 to ₹1500.00", change.Description);
        Assert.Equal(Domain.Constants.AuditModules.Showrooms, change.Module);
    }

    [Fact]
    public async Task P1_4_DailyBill_RejectedChange_IsNotAudited()
    {
        var env = await CreateShowroomEnvAsync();
        var showroom = await env.Showrooms.CreateAsync(new CreateShowroomRequest { Name = "Tata Motors", Address = "Erode", IsActive = true });

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            env.Showrooms.SetDailyBillAsync(showroom.Id, new DateTime(2026, 10, 6), new SetShowroomDailyBillRequest { Amount = -1m }));

        Assert.DoesNotContain(env.Audit.Entries, e => e.Action == "showroom.set_daily_bill");
    }

    // ── P1-5: role / permission change audit ────────────────────────────────

    private sealed record UserEnv(AppDbContext Db, UserService Users, CapturingAuditLogService Audit, User Owner, User Target);

    private static async Task<UserEnv> CreateUserEnvAsync()
    {
        var db = NewDb();
        var audit = new CapturingAuditLogService();
        var hasher = new PasswordHasherService();
        var view = new Permission { Code = "customers.view", Name = "View", Module = "Customers" };
        var edit = new Permission { Code = "customers.edit", Name = "Edit", Module = "Customers" };
        db.Permissions.AddRange(view, edit);

        var owner = new User { FullName = "owner", Username = "owner", Role = UserRole.Owner, IsActive = true };
        owner.PasswordHash = hasher.HashPassword(owner, "Original-Pass123!");
        var target = new User { FullName = "target", Username = "target", Role = UserRole.Staff, IsActive = true };
        target.PasswordHash = hasher.HashPassword(target, "Original-Pass123!");
        target.UserPermissions.Add(new UserPermission { UserId = target.Id, PermissionId = view.Id });
        db.Users.AddRange(owner, target);
        await db.SaveChangesAsync();
        return new UserEnv(db, new UserService(db, hasher, audit), audit, owner, target);
    }

    [Fact]
    public async Task P1_5_RoleOnlyChange_IsAuditedWithOldAndNewRole()
    {
        var env = await CreateUserEnvAsync();

        // Clients always resend the (unchanged) permission list.
        await env.Users.UpdateUserAsync(env.Target.Id, new UpdateUserRequest { FullName = "target", Role = "Manager", PermissionCodes = ["customers.view"] }, env.Owner.Id, isOwner: true);

        var entry = Assert.Single(env.Audit.Entries, e => e.EntityId == env.Target.Id);
        Assert.Equal(AuditActions.Update, entry.Action);
        Assert.Equal("Staff", Json(entry.OldValues).GetProperty("role").GetString());
        Assert.Equal("Manager", Json(entry.NewValues).GetProperty("role").GetString());
    }

    [Fact]
    public async Task P1_5_PermissionOnlyChange_IsAuditedWithOldAndNewPermissions()
    {
        var env = await CreateUserEnvAsync();

        await env.Users.UpdateUserAsync(env.Target.Id, new UpdateUserRequest { FullName = "target", Role = "Staff", PermissionCodes = ["customers.view", "customers.edit"] }, env.Owner.Id, isOwner: true);

        var entry = Assert.Single(env.Audit.Entries, e => e.EntityId == env.Target.Id);
        Assert.Equal(AuditActions.PermissionChanged, entry.Action);
        Assert.Equal(["customers.view"], Json(entry.OldValues).GetProperty("permissions").EnumerateArray().Select(p => p.GetString()));
        Assert.Equal(["customers.view", "customers.edit"], Json(entry.NewValues).GetProperty("permissions").EnumerateArray().Select(p => p.GetString()));
        Assert.Equal("Staff", Json(entry.OldValues).GetProperty("role").GetString());
        Assert.Equal("Staff", Json(entry.NewValues).GetProperty("role").GetString());
    }

    [Fact]
    public async Task P1_5_RoleAndPermissionChangeTogether_AreBothInTheAuditEntry()
    {
        var env = await CreateUserEnvAsync();

        await env.Users.UpdateUserAsync(env.Target.Id, new UpdateUserRequest { FullName = "target", Role = "Manager", PermissionCodes = ["customers.edit"] }, env.Owner.Id, isOwner: true);

        var entry = Assert.Single(env.Audit.Entries, e => e.EntityId == env.Target.Id);
        Assert.Equal(AuditActions.PermissionChanged, entry.Action);
        Assert.Equal("Staff", Json(entry.OldValues).GetProperty("role").GetString());
        Assert.Equal("Manager", Json(entry.NewValues).GetProperty("role").GetString());
        Assert.Equal(["customers.view"], Json(entry.OldValues).GetProperty("permissions").EnumerateArray().Select(p => p.GetString()));
        Assert.Equal(["customers.edit"], Json(entry.NewValues).GetProperty("permissions").EnumerateArray().Select(p => p.GetString()));
        Assert.Contains("Role changed from 'Staff' to 'Manager'", entry.Description);
    }

    [Fact]
    public async Task P1_5_NoRoleOrPermissionChange_IsAProfileUpdate_NotAPermissionChange()
    {
        var env = await CreateUserEnvAsync();

        await env.Users.UpdateUserAsync(env.Target.Id, new UpdateUserRequest { FullName = "target renamed", Role = "Staff", PermissionCodes = ["customers.view"] }, env.Owner.Id, isOwner: true);

        var entry = Assert.Single(env.Audit.Entries, e => e.EntityId == env.Target.Id);
        Assert.Equal(AuditActions.Update, entry.Action);
        Assert.Equal("Staff", Json(entry.OldValues).GetProperty("role").GetString());
        Assert.Equal("Staff", Json(entry.NewValues).GetProperty("role").GetString());
        Assert.DoesNotContain(env.Audit.Entries, e => e.Action == AuditActions.PermissionChanged);
        // Permissions are still exactly what was sent.
        var codes = await env.Db.UserPermissions.Where(up => up.UserId == env.Target.Id).Select(up => up.Permission.Code).ToListAsync();
        Assert.Equal(["customers.view"], codes);
    }

    [Fact]
    public async Task P1_5_RoleChangeStillRequiresOwner()
    {
        var env = await CreateUserEnvAsync();
        var manager = new User { FullName = "mgr", Username = "mgr", Role = UserRole.Manager, IsActive = true, PasswordHash = "x" };
        env.Db.Users.Add(manager);
        await env.Db.SaveChangesAsync();

        await Assert.ThrowsAsync<ForbiddenException>(() => env.Users.UpdateUserAsync(env.Target.Id,
            new UpdateUserRequest { FullName = "target", Role = "Manager" }, manager.Id, isOwner: false));
        Assert.Equal(UserRole.Staff, (await env.Db.Users.AsNoTracking().SingleAsync(u => u.Id == env.Target.Id)).Role);
    }
}
