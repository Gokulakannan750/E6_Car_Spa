using CarSpaManagement.Api.Domain.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CarSpaManagement.Api.Infrastructure.Platform;

/// <summary>Trovo's catalog database: products, companies, where each company's database is, registration codes.</summary>
public class PlatformDbContext(DbContextOptions<PlatformDbContext> options) : DbContext(options)
{
    public DbSet<PlatformProduct> Products => Set<PlatformProduct>();
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
    public DbSet<BillingInvoiceLine> BillingInvoiceLines => Set<BillingInvoiceLine>();
    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();
    public DbSet<PaymentWebhookEvent> PaymentWebhookEvents => Set<PaymentWebhookEvent>();
    public DbSet<PlatformAdmin> Admins => Set<PlatformAdmin>();
    public DbSet<PlatformAuditLog> AuditLogs => Set<PlatformAuditLog>();
    public DbSet<PlatformCounter> Counters => Set<PlatformCounter>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PlatformProduct>(e =>
        {
            e.ToTable("Products");
            e.HasIndex(p => p.Key).IsUnique();
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
            e.HasOne(v => v.Plan).WithMany(p => p.Versions).HasForeignKey(v => v.PlanId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(v => new { v.PlanId, v.Version, v.Interval }).IsUnique();
            e.Property(v => v.Interval).HasConversion<string>().HasMaxLength(10);
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
            e.Property(i => i.TaxRatePercent).HasPrecision(5, 2);
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
