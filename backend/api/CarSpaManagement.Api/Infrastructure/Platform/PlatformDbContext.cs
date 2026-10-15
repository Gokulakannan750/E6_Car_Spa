using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>Trovo's catalog database: products, companies, where each company's database is, registration codes.</summary>
public class PlatformDbContext(DbContextOptions<PlatformDbContext> options) : DbContext(options)
{
    public DbSet<PlatformProduct> Products => Set<PlatformProduct>();
    public DbSet<ProductSeatType> ProductSeatTypes => Set<ProductSeatType>();
    public DbSet<ProductFeature> ProductFeatures => Set<ProductFeature>();
    public DbSet<SubscriptionSeat> SubscriptionSeats => Set<SubscriptionSeat>();
    public DbSet<PlanVersionSeatPrice> PlanVersionSeatPrices => Set<PlanVersionSeatPrice>();
    public DbSet<SignupOrderSeat> SignupOrderSeats => Set<SignupOrderSeat>();
    public DbSet<PlatformCompany> Companies => Set<PlatformCompany>();
    public DbSet<PlatformRegistrationCode> RegistrationCodes => Set<PlatformRegistrationCode>();

    public DbSet<Plan> Plans => Set<Plan>();
    public DbSet<PlanVersion> PlanVersions => Set<PlanVersion>();
    public DbSet<PlanEntitlement> PlanEntitlements => Set<PlanEntitlement>();
    public DbSet<AddOn> AddOns => Set<AddOn>();
    public DbSet<AddOnPrice> AddOnPrices => Set<AddOnPrice>();
    public DbSet<BillingAccount> BillingAccounts => Set<BillingAccount>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<SubscriptionItem> SubscriptionItems => Set<SubscriptionItem>();
    public DbSet<SubscriptionEvent> SubscriptionEvents => Set<SubscriptionEvent>();
    public DbSet<BillingInvoice> BillingInvoices => Set<BillingInvoice>();
    public DbSet<PlanChangeRequest> PlanChangeRequests => Set<PlanChangeRequest>();
    public DbSet<BillingInvoiceLine> BillingInvoiceLines => Set<BillingInvoiceLine>();
    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();
    public DbSet<PaymentWebhookEvent> PaymentWebhookEvents => Set<PaymentWebhookEvent>();
    public DbSet<PlatformAdmin> Admins => Set<PlatformAdmin>();
    public DbSet<PlatformSetting> Settings => Set<PlatformSetting>();
    public DbSet<SignupOrder> SignupOrders => Set<SignupOrder>();
    public DbSet<FranchiseSignupCode> FranchiseSignupCodes => Set<FranchiseSignupCode>();
    public DbSet<PlatformAuditLog> AuditLogs => Set<PlatformAuditLog>();
    public DbSet<PlatformCounter> Counters => Set<PlatformCounter>();

    /// <summary>Franchise links between two companies (on the platform they cannot live in either company's database).</summary>
    public DbSet<FranchiseLink> FranchiseLinks => Set<FranchiseLink>();
    public DbSet<FranchiseLinkScope> FranchiseLinkScopes => Set<FranchiseLinkScope>();

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<CarSpaManagement.Api.Domain.Common.BaseEntity>())
        {
            if (entry.State == EntityState.Added && entry.Entity.CreatedAt == default) entry.Entity.CreatedAt = DateTime.UtcNow;
            if (entry.State == EntityState.Modified) entry.Entity.UpdatedAt = DateTime.UtcNow;
        }
        return base.SaveChangesAsync(cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PlatformProduct>(e =>
        {
            e.ToTable("Products");
            e.HasIndex(p => p.Key).IsUnique();
            e.Property(p => p.SeatModel).HasConversion<string>().HasMaxLength(10).HasDefaultValue(SeatModel.None);
            e.Property(p => p.TrialPlanCode).HasDefaultValue("professional");
        });

        modelBuilder.Entity<ProductSeatType>(e =>
        {
            e.ToTable("ProductSeatTypes", t => t.HasCheckConstraint("CK_ProductSeatTypes_Code", "\"Code\" = lower(\"Code\")"));
            e.Property(s => s.Id).ValueGeneratedNever();
            e.HasOne<PlatformProduct>().WithMany().HasForeignKey(s => s.ProductId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(s => new { s.ProductId, s.Code }).IsUnique();
        });
        modelBuilder.Entity<ProductFeature>(e =>
        {
            e.ToTable("ProductFeatures");
            e.Property(f => f.Id).ValueGeneratedNever();
            e.HasOne<PlatformProduct>().WithMany().HasForeignKey(f => f.ProductId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(f => new { f.ProductId, f.Key }).IsUnique();
            e.Property(f => f.ValueType).HasConversion<string>().HasMaxLength(10);
        });
        modelBuilder.Entity<SubscriptionSeat>(e =>
        {
            e.ToTable("SubscriptionSeats");
            e.Property(s => s.Id).ValueGeneratedNever();
            e.HasOne<Subscription>().WithMany(s => s.Seats).HasForeignKey(s => s.SubscriptionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(s => s.SeatType).WithMany().HasForeignKey(s => s.SeatTypeId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(s => new { s.SubscriptionId, s.SeatTypeId }).IsUnique();
            e.Navigation(s => s.SeatType).AutoInclude();
        });
        modelBuilder.Entity<PlanVersionSeatPrice>(e =>
        {
            e.ToTable("PlanVersionSeatPrices");
            e.Property(p => p.Id).ValueGeneratedNever();
            e.HasOne<PlanVersion>().WithMany(v => v.SeatPrices).HasForeignKey(p => p.PlanVersionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(p => p.SeatType).WithMany().HasForeignKey(p => p.SeatTypeId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(p => new { p.PlanVersionId, p.SeatTypeId }).IsUnique();
            e.Navigation(p => p.SeatType).AutoInclude();
        });
        modelBuilder.Entity<SignupOrderSeat>(e =>
        {
            e.ToTable("SignupOrderSeats");
            e.Property(s => s.Id).ValueGeneratedNever();
            e.HasOne<SignupOrder>().WithMany(o => o.Seats).HasForeignKey(s => s.SignupOrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(s => s.SeatType).WithMany().HasForeignKey(s => s.SeatTypeId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(s => new { s.SignupOrderId, s.SeatTypeId }).IsUnique();
            e.Navigation(s => s.SeatType).AutoInclude();
        });

        modelBuilder.Entity<PlatformCompany>(e =>
        {
            e.ToTable("Companies");
            e.HasOne(c => c.Product).WithMany().HasForeignKey(c => c.ProductId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(c => new { c.ProductId, c.Code }).IsUnique();
            e.HasIndex(c => c.DatabaseName).IsUnique();
            e.HasIndex(c => c.DatabaseUser).IsUnique();
            e.Property(c => c.Status).HasConversion<string>().HasMaxLength(30);
        });

        modelBuilder.Entity<PlatformRegistrationCode>(e =>
        {
            e.ToTable("RegistrationCodes");
            e.HasOne(r => r.Company).WithMany().HasForeignKey(r => r.CompanyId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(r => r.CompanyId);
        });

        // ── Plans and add-ons ────────────────────────────────────────────────
        modelBuilder.Entity<Plan>(e =>
        {
            e.ToTable("Plans");
            e.HasOne(p => p.Product).WithMany().HasForeignKey(p => p.ProductId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(p => new { p.ProductId, p.Code }).IsUnique();
        });
        modelBuilder.Entity<PlanVersion>(e =>
        {
            e.ToTable("PlanVersions");
            e.Navigation(v => v.SeatPrices).AutoInclude();
            e.HasOne(v => v.Plan).WithMany(p => p.Versions).HasForeignKey(v => v.PlanId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(v => new { v.PlanId, v.Version, v.Interval }).IsUnique();
            e.Property(v => v.Interval).HasConversion<string>().HasMaxLength(10);
        });
        modelBuilder.Entity<PlatformSetting>(e => e.ToTable("PlatformSettings"));
        modelBuilder.Entity<SignupOrder>(e =>
        {
            e.ToTable("SignupOrders");
            e.Navigation(o => o.Seats).AutoInclude();
            e.Property(o => o.Start).HasConversion<string>().HasMaxLength(10);
            e.Property(o => o.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(o => o.Interval).HasConversion<string>().HasMaxLength(10);
            e.HasIndex(o => new { o.ProductId, o.Email });
            e.HasIndex(o => new { o.ProductId, o.Mobile });
            e.HasIndex(o => o.CompanyId);
        });
        modelBuilder.Entity<FranchiseSignupCode>(e =>
        {
            e.ToTable("FranchiseSignupCodes");
            e.HasIndex(c => c.CodeHash).IsUnique();
            e.HasIndex(c => new { c.FranchisorCompanyId, c.CreatedAt });
        });
        modelBuilder.Entity<PlanEntitlement>(e =>
        {
            e.ToTable("PlanEntitlements");
            e.HasOne<PlanVersion>().WithMany(v => v.Entitlements).HasForeignKey(x => x.PlanVersionId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.PlanVersionId, x.FeatureKey }).IsUnique();
            e.Property(x => x.ValueType).HasConversion<string>().HasMaxLength(10);
        });
        modelBuilder.Entity<AddOn>(e =>
        {
            e.ToTable("AddOns");
            e.HasOne<PlatformProduct>().WithMany().HasForeignKey(a => a.ProductId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(a => new { a.ProductId, a.Code }).IsUnique();
        });
        modelBuilder.Entity<AddOnPrice>(e =>
        {
            e.ToTable("AddOnPrices");
            e.HasOne(p => p.AddOn).WithMany(a => a.Prices).HasForeignKey(p => p.AddOnId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(p => new { p.AddOnId, p.Version, p.Interval }).IsUnique();
            e.Property(p => p.Interval).HasConversion<string>().HasMaxLength(10);
        });

        // ── Billing accounts and subscriptions ───────────────────────────────
        modelBuilder.Entity<BillingAccount>(e =>
        {
            e.ToTable("BillingAccounts");
            e.HasOne(b => b.Company).WithMany().HasForeignKey(b => b.CompanyId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(b => b.CompanyId).IsUnique(); // one per company: every company pays for itself
        });
        modelBuilder.Entity<Subscription>(e =>
        {
            e.ToTable("Subscriptions");
            e.Navigation(s => s.Seats).AutoInclude();
            e.HasOne(s => s.Company).WithMany().HasForeignKey(s => s.CompanyId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(s => s.BillingAccount).WithMany().HasForeignKey(s => s.BillingAccountId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(s => s.PlanVersion).WithMany().HasForeignKey(s => s.PlanVersionId).OnDelete(DeleteBehavior.Restrict);
            e.Property(s => s.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(s => s.StatusBeforeSuspension).HasConversion<string>().HasMaxLength(20);
            // At most one current subscription per company, enforced by the database.
            e.HasIndex(s => s.CompanyId).IsUnique().HasFilter("\"IsCurrent\"").HasDatabaseName("UX_Subscriptions_CurrentPerCompany");
            e.HasIndex(s => new { s.GatewayProvider, s.GatewaySubscriptionId }).IsUnique()
                .HasFilter("\"GatewaySubscriptionId\" IS NOT NULL");
            e.HasIndex(s => new { s.Status, s.GraceEndsAt });
        });
        modelBuilder.Entity<SubscriptionItem>(e =>
        {
            e.ToTable("SubscriptionItems");
            e.HasOne(i => i.Subscription).WithMany(s => s.Items).HasForeignKey(i => i.SubscriptionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(i => i.AddOnPrice).WithMany().HasForeignKey(i => i.AddOnPriceId).OnDelete(DeleteBehavior.Restrict);
            e.Property(i => i.ItemType).HasConversion<string>().HasMaxLength(20);
        });
        modelBuilder.Entity<SubscriptionEvent>(e =>
        {
            e.ToTable("SubscriptionEvents");
            e.HasOne<Subscription>().WithMany().HasForeignKey(x => x.SubscriptionId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.SubscriptionId, x.EffectiveAt });
            e.Property(x => x.ActorType).HasConversion<string>().HasMaxLength(10);
            e.Property(x => x.Metadata).HasColumnType("jsonb");
        });

        // ── Trovo invoices and payments ──────────────────────────────────────
        modelBuilder.Entity<BillingInvoice>(e =>
        {
            e.ToTable("BillingInvoices");
            e.HasOne<PlatformCompany>().WithMany().HasForeignKey(i => i.CompanyId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Subscription>().WithMany().HasForeignKey(i => i.SubscriptionId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<BillingAccount>().WithMany().HasForeignKey(i => i.BillingAccountId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(i => i.InvoiceNumber).IsUnique();
            e.HasIndex(i => new { i.CompanyId, i.IssuedAt });
            e.Property(i => i.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(i => i.Kind).HasConversion<string>().HasMaxLength(20).HasDefaultValue(BillingInvoiceKind.Period);
            e.Property(i => i.TaxRatePercent).HasPrecision(5, 2);
        });
        modelBuilder.Entity<PlanChangeRequest>(e =>
        {
            e.ToTable("PlanChangeRequests");
            e.HasOne<PlatformCompany>().WithMany().HasForeignKey(r => r.CompanyId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Subscription>().WithMany().HasForeignKey(r => r.SubscriptionId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(r => new { r.CompanyId, r.Status });
            e.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(r => r.Timing).HasConversion<string>().HasMaxLength(20);
            e.Property(r => r.Interval).HasConversion<string>().HasMaxLength(10);
        });
        modelBuilder.Entity<BillingInvoiceLine>(e =>
        {
            e.ToTable("BillingInvoiceLines");
            e.HasOne<BillingInvoice>().WithMany(i => i.Lines).HasForeignKey(l => l.BillingInvoiceId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<PaymentTransaction>(e =>
        {
            e.ToTable("PaymentTransactions");
            e.HasOne(p => p.BillingInvoice).WithMany().HasForeignKey(p => p.BillingInvoiceId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(p => new { p.Provider, p.ProviderPaymentId }).IsUnique().HasFilter("\"ProviderPaymentId\" IS NOT NULL");
            e.HasIndex(p => new { p.Provider, p.ProviderOrderId }).IsUnique().HasFilter("\"ProviderOrderId\" IS NOT NULL");
            e.Property(p => p.Status).HasConversion<string>().HasMaxLength(20);
        });
        modelBuilder.Entity<PaymentWebhookEvent>(e =>
        {
            e.ToTable("PaymentWebhookEvents");
            e.HasIndex(w => new { w.Provider, w.ProviderEventId }).IsUnique();
        });

        // ── Platform administration ──────────────────────────────────────────
        modelBuilder.Entity<PlatformAdmin>(e =>
        {
            e.ToTable("PlatformAdmins");
            e.HasIndex(a => a.Email).IsUnique();
            e.Property(a => a.Role).HasConversion<string>().HasMaxLength(20);
        });
        modelBuilder.Entity<PlatformAuditLog>(e =>
        {
            e.ToTable("PlatformAuditLogs");
            e.HasIndex(a => a.CreatedAt);
            e.HasIndex(a => new { a.TargetCompanyId, a.CreatedAt });
            e.Property(a => a.BeforeValues).HasColumnType("jsonb");
            e.Property(a => a.AfterValues).HasColumnType("jsonb");
        });
        modelBuilder.Entity<PlatformCounter>(e =>
        {
            e.ToTable("PlatformCounters");
            e.HasKey(c => c.Key);
        });

        // ── Franchise links (consent, scopes and lifecycle; independent of billing) ──
        modelBuilder.Entity<FranchiseLink>(e =>
        {
            e.ToTable("FranchiseLinks");
            e.HasKey(l => l.Id);
            e.Property(l => l.Id).ValueGeneratedNever();
            e.Property(l => l.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
            e.HasOne<PlatformCompany>().WithMany().HasForeignKey(l => l.FranchisorOrganizationId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<PlatformCompany>().WithMany().HasForeignKey(l => l.FranchiseeOrganizationId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(l => new { l.FranchisorOrganizationId, l.FranchiseeOrganizationId }).IsUnique()
                .HasFilter("\"Status\" IN ('Pending', 'Active')").HasDatabaseName("UX_FranchiseLinks_OpenLink");
            e.Property(l => l.InviteTokenHash).HasMaxLength(64);
            e.HasIndex(l => l.InviteTokenHash).IsUnique().HasFilter("\"InviteTokenHash\" IS NOT NULL")
                .HasDatabaseName("UX_FranchiseLinks_InviteTokenHash");
            e.HasIndex(l => l.FranchiseeOrganizationId);
            e.ToTable(t => t.HasCheckConstraint("CK_FranchiseLinks_DifferentCompanies", "\"FranchisorOrganizationId\" <> \"FranchiseeOrganizationId\""));
            e.HasQueryFilter(l => !l.IsDeleted);
        });
        modelBuilder.Entity<FranchiseLinkScope>(e =>
        {
            e.ToTable("FranchiseLinkScopes");
            e.HasKey(s => s.Id);
            e.Property(s => s.Id).ValueGeneratedNever();
            e.Property(s => s.Scope).HasMaxLength(40).IsRequired();
            e.Property(s => s.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
            e.HasOne(s => s.FranchiseLink).WithMany(l => l.Scopes).HasForeignKey(s => s.FranchiseLinkId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(s => new { s.FranchiseLinkId, s.Scope }).IsUnique();
            e.HasIndex(s => s.FranchiseeOrganizationId);
            e.HasQueryFilter(s => !s.IsDeleted);
        });
    }
}

/// <summary>Lets "dotnet ef" build the catalog model without starting the web host.</summary>
public class PlatformDbContextDesignTimeFactory : IDesignTimeDbContextFactory<PlatformDbContext>
{
    public PlatformDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<PlatformDbContext>()
            .UseNpgsql("Host=localhost;Database=carspa_platform_design")
            .Options;
        return new PlatformDbContext(options);
    }
}
