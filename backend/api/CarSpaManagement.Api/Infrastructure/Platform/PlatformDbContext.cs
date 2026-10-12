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
