using CarSpaManagement.Api.Domain.Common;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Infrastructure.Database;

public class AppDbContext : DbContext
{
    /// <summary>Name of the filter that hides soft-deleted rows.</summary>
    public const string SoftDeleteFilter = "SoftDelete";

    /// <summary>Name of the filter that limits every query to the current company.</summary>
    public const string TenantFilter = "Tenant";

    private readonly ITenantContext _tenant;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantContext tenant) : base(options)
    {
        _tenant = tenant;
    }

    /// <summary>
    /// For callers that run for the single default company (older tools and tests). Production code gets the
    /// request's company through dependency injection instead.
    /// </summary>
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : this(options, new FixedTenantContext(DefaultOrganization.Id))
    {
    }

    /// <summary>The company this context works for. With none, the filter matches nothing (fail closed).</summary>
    public Guid CurrentOrganizationId => _tenant.OrganizationId ?? Guid.Empty;

    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<Service> Services => Set<Service>();
    public DbSet<JobCard> JobCards => Set<JobCard>();
    public DbSet<JobCardService> JobCardServices => Set<JobCardService>();
    public DbSet<OutsideJob> OutsideJobs => Set<OutsideJob>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<Staff> Staff => Set<Staff>();
    public DbSet<StaffAdvance> StaffAdvances => Set<StaffAdvance>();
    public DbSet<StaffSalarySettlement> StaffSalarySettlements => Set<StaffSalarySettlement>();
    public DbSet<StaffAttendance> StaffAttendances => Set<StaffAttendance>();
    public DbSet<StaffDailyAttendanceConfirmation> StaffDailyAttendanceConfirmations => Set<StaffDailyAttendanceConfirmation>();
    public DbSet<Showroom> Showrooms => Set<Showroom>();
    public DbSet<ShowroomStaffAssignment> ShowroomStaffAssignments => Set<ShowroomStaffAssignment>();
    public DbSet<ShowroomDailyAttendance> ShowroomDailyAttendances => Set<ShowroomDailyAttendance>();
    public DbSet<ShowroomDailyBill> ShowroomDailyBills => Set<ShowroomDailyBill>();
    public DbSet<ShowroomPayment> ShowroomPayments => Set<ShowroomPayment>();
    public DbSet<ShowroomVehicleType> ShowroomVehicleTypes => Set<ShowroomVehicleType>();
    public DbSet<ShowroomWorkType> ShowroomWorkTypes => Set<ShowroomWorkType>();
    public DbSet<ShowroomStaffWorkSession> ShowroomStaffWorkSessions => Set<ShowroomStaffWorkSession>();
    public DbSet<ShowroomStaffSwap> ShowroomStaffSwaps => Set<ShowroomStaffSwap>();
    public DbSet<ShowroomVehicleWork> ShowroomVehicleWorks => Set<ShowroomVehicleWork>();
    public DbSet<ShowroomVehicleWorkItem> ShowroomVehicleWorkItems => Set<ShowroomVehicleWorkItem>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceItem> InvoiceItems => Set<InvoiceItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserPermission> UserPermissions => Set<UserPermission>();
    public DbSet<BusinessProfile> BusinessProfiles => Set<BusinessProfile>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<InvoicePublicLink> InvoicePublicLinks => Set<InvoicePublicLink>();
    public DbSet<WhatsAppConfiguration> WhatsAppConfigurations => Set<WhatsAppConfiguration>();
    public DbSet<WhatsAppMessage> WhatsAppMessages => Set<WhatsAppMessage>();
    public DbSet<SystemPreference> SystemPreferences => Set<SystemPreference>();
    public DbSet<InvoiceNumberSeries> InvoiceNumberSeries => Set<InvoiceNumberSeries>();
    public DbSet<InvoiceNumberAllocation> InvoiceNumberAllocations => Set<InvoiceNumberAllocation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Showroom>()
            .HasIndex(s => s.MasterId)
            .IsUnique();

        modelBuilder.Entity<ShowroomStaffAssignment>()
            .HasIndex(s => new { s.ShowroomId, s.StaffId, s.Date });

        modelBuilder.Entity<ShowroomDailyBill>()
            .HasIndex(b => new { b.ShowroomId, b.Date });

        // Apply all IEntityTypeConfiguration implementations from this assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Two named query filters. They are separate so that code which needs to see deleted rows (for example to
        // check that a number was never used) can switch off only the soft-delete filter and still stay inside its
        // own company. Use IgnoreQueryFilters([SoftDeleteFilter]), never IgnoreQueryFilters(), for that.
        foreach (var entityType in modelBuilder.Model.GetEntityTypes().ToList())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
            {
                typeof(AppDbContext).GetMethod(nameof(ApplySoftDeleteFilter),
                        System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!
                    .MakeGenericMethod(entityType.ClrType)
                    .Invoke(this, [modelBuilder]);
            }

            if (typeof(IOrganizationOwned).IsAssignableFrom(entityType.ClrType))
            {
                typeof(AppDbContext).GetMethod(nameof(ApplyTenantFilter),
                        System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!
                    .MakeGenericMethod(entityType.ClrType)
                    .Invoke(this, [modelBuilder]);
            }
        }
    }

    private void ApplySoftDeleteFilter<T>(ModelBuilder builder) where T : BaseEntity
    {
        builder.Entity<T>().HasQueryFilter(SoftDeleteFilter, e => !e.IsDeleted);
    }

    private void ApplyTenantFilter<T>(ModelBuilder builder) where T : class, IOrganizationOwned
    {
        var entity = builder.Entity<T>();
        entity.HasQueryFilter(TenantFilter, e => e.OrganizationId == CurrentOrganizationId);
        entity.HasOne<Organization>().WithMany().HasForeignKey(e => e.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        entity.HasIndex(e => e.OrganizationId);
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        PrepareForSave();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        PrepareForSave();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    /// <summary>Runs on every save path (sync and async): company checks first, then the audit timestamps.</summary>
    private void PrepareForSave()
    {
        EnforceOrganizationOwnership();

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    if (entry.Entity.CreatedAt == default)
                    {
                        entry.Entity.CreatedAt = DateTime.UtcNow;
                    }
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = DateTime.UtcNow;
                    break;
            }
        }
    }

    /// <summary>
    /// New company-owned rows get the current company stamped on them; rows can never be written to, moved to or
    /// deleted from a different company. Platform operations that create a new company's first rows must set
    /// <c>OrganizationId</c> explicitly while no company is current.
    /// </summary>
    private void EnforceOrganizationOwnership()
    {
        var current = _tenant.OrganizationId;

        foreach (var entry in ChangeTracker.Entries<IOrganizationOwned>())
        {
            var entity = entry.Entity;
            switch (entry.State)
            {
                case EntityState.Added:
                    if (entity.OrganizationId == Guid.Empty)
                    {
                        entity.OrganizationId = current
                            ?? throw new TenantViolationException(
                                $"Cannot save {entry.Metadata.ClrType.Name}: no company is set for this request.");
                    }
                    else if (current is { } c && entity.OrganizationId != c)
                    {
                        throw new TenantViolationException(
                            $"Cannot save {entry.Metadata.ClrType.Name} for a different company.");
                    }
                    break;

                case EntityState.Modified:
                case EntityState.Deleted:
                    var property = entry.Property(nameof(IOrganizationOwned.OrganizationId));
                    if (property.IsModified && !Equals(property.OriginalValue, property.CurrentValue))
                    {
                        throw new TenantViolationException(
                            $"{entry.Metadata.ClrType.Name} cannot be moved to a different company.");
                    }
                    if (current is { } cur && entity.OrganizationId != cur)
                    {
                        throw new TenantViolationException(
                            $"Cannot change {entry.Metadata.ClrType.Name} that belongs to a different company.");
                    }
                    break;
            }
        }
    }
}
