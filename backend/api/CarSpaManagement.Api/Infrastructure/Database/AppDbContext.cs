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
    public DbSet<OrganizationCounter> OrganizationCounters => Set<OrganizationCounter>();
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
            .HasIndex(s => new { s.OrganizationId, s.MasterId })
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
        var references = CollectForeignReferences();
        if (references.Count > 0)
        {
            EnsureReferencesStayInCompany(references);
        }
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        PrepareForSave();
        var references = CollectForeignReferences();
        if (references.Count > 0)
        {
            await EnsureReferencesStayInCompanyAsync(references, cancellationToken);
        }
        return await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
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

    private sealed record ForeignReference(Type PrincipalType, string KeyName, Guid Key, Guid Organization, string Dependent);

    /// <summary>
    /// The links a save is about to create or change from company-owned rows to other company-owned rows. A link to
    /// a row that is itself part of this save is checked on the spot; the rest are checked against the database.
    /// </summary>
    private List<ForeignReference> CollectForeignReferences()
    {
        var found = new List<ForeignReference>();
        var tracked = new Dictionary<(Type, Guid), Guid>();
        var candidates = new List<Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry>();

        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.Entity is not IOrganizationOwned owned)
            {
                continue;
            }

            if (entry.Metadata.FindPrimaryKey() is { Properties.Count: 1 } key
                && entry.Property(key.Properties[0].Name).CurrentValue is Guid id)
            {
                tracked[(entry.Metadata.ClrType, id)] = owned.OrganizationId;
            }

            if (entry.State is EntityState.Added or EntityState.Modified)
            {
                candidates.Add(entry);
            }
        }

        foreach (var entry in candidates)
        {
            var organization = ((IOrganizationOwned)entry.Entity).OrganizationId;
            foreach (var foreignKey in entry.Metadata.GetForeignKeys())
            {
                var principalType = foreignKey.PrincipalEntityType.ClrType;
                if (!typeof(IOrganizationOwned).IsAssignableFrom(principalType)
                    || foreignKey.Properties.Count != 1
                    || foreignKey.PrincipalKey.Properties.Count != 1)
                {
                    continue;
                }

                var property = foreignKey.Properties[0];
                if (entry.State == EntityState.Modified && !entry.Property(property.Name).IsModified)
                {
                    continue;
                }

                if (entry.CurrentValues[property] is not Guid value || value == Guid.Empty)
                {
                    continue;
                }

                if (tracked.TryGetValue((principalType, value), out var principalOrganization))
                {
                    if (principalOrganization != organization)
                    {
                        throw ForeignCompany(entry.Metadata.ClrType.Name, principalType.Name);
                    }
                    continue;
                }

                found.Add(new ForeignReference(principalType, foreignKey.PrincipalKey.Properties[0].Name, value,
                    organization, entry.Metadata.ClrType.Name));
            }
        }

        return found;
    }

    private static TenantViolationException ForeignCompany(string dependent, string principal) =>
        new($"{dependent} refers to a {principal} from a different company.");

    private static readonly System.Reflection.MethodInfo ForeignOwnedQueryMethod =
        typeof(AppDbContext).GetMethod(nameof(ForeignOwnedQuery), System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;

    /// <summary>Of these keys, the ones that exist but belong to some other company (deleted rows included).</summary>
    private IQueryable<Guid> ForeignOwnedQuery<T>(string keyName, List<Guid> keys, Guid organization)
        where T : class, IOrganizationOwned =>
        Set<T>().IgnoreQueryFilters()
            .Where(e => keys.Contains(EF.Property<Guid>(e, keyName)) && e.OrganizationId != organization)
            .Select(e => EF.Property<Guid>(e, keyName));

    private IEnumerable<(IQueryable<Guid> Query, string Dependent, string Principal)> ForeignReferenceQueries(
        List<ForeignReference> references)
    {
        foreach (var group in references.GroupBy(r => (r.PrincipalType, r.KeyName, r.Organization)))
        {
            var keys = group.Select(r => r.Key).Distinct().ToList();
            var query = (IQueryable<Guid>)ForeignOwnedQueryMethod.MakeGenericMethod(group.Key.PrincipalType)
                .Invoke(this, [group.Key.KeyName, keys, group.Key.Organization])!;
            yield return (query, group.First().Dependent, group.Key.PrincipalType.Name);
        }
    }

    private void EnsureReferencesStayInCompany(List<ForeignReference> references)
    {
        foreach (var (query, dependent, principal) in ForeignReferenceQueries(references))
        {
            if (query.Any())
            {
                throw ForeignCompany(dependent, principal);
            }
        }
    }

    private async Task EnsureReferencesStayInCompanyAsync(List<ForeignReference> references, CancellationToken cancellationToken)
    {
        foreach (var (query, dependent, principal) in ForeignReferenceQueries(references))
        {
            if (await query.AnyAsync(cancellationToken))
            {
                throw ForeignCompany(dependent, principal);
            }
        }
    }
}
