using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class FranchiseLinkConfiguration : IEntityTypeConfiguration<FranchiseLink>
{
    public void Configure(EntityTypeBuilder<FranchiseLink> builder)
    {
        builder.ToTable("FranchiseLinks");

        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).ValueGeneratedNever();

        builder.Property(l => l.Status).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.HasOne<Organization>().WithMany().HasForeignKey(l => l.FranchisorOrganizationId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Organization>().WithMany().HasForeignKey(l => l.FranchiseeOrganizationId).OnDelete(DeleteBehavior.Restrict);

        // Two companies can have only one open (pending or active) link in each direction at a time.
        builder.HasIndex(l => new { l.FranchisorOrganizationId, l.FranchiseeOrganizationId })
            .IsUnique()
            .HasFilter("\"Status\" IN ('Pending', 'Active')")
            .HasDatabaseName("UX_FranchiseLinks_OpenLink");

        builder.Property(l => l.InviteTokenHash).HasMaxLength(64);
        builder.HasIndex(l => l.InviteTokenHash).IsUnique().HasFilter("\"InviteTokenHash\" IS NOT NULL")
            .HasDatabaseName("UX_FranchiseLinks_InviteTokenHash");

        builder.HasIndex(l => l.FranchiseeOrganizationId);
        builder.HasCheckConstraint("CK_FranchiseLinks_DifferentCompanies", "\"FranchisorOrganizationId\" <> \"FranchiseeOrganizationId\"");
    }
}

public class FranchiseLinkScopeConfiguration : IEntityTypeConfiguration<FranchiseLinkScope>
{
    public void Configure(EntityTypeBuilder<FranchiseLinkScope> builder)
    {
        builder.ToTable("FranchiseLinkScopes");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();

        builder.Property(s => s.Scope).HasMaxLength(40).IsRequired();
        builder.Property(s => s.Status).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.HasOne(s => s.FranchiseLink).WithMany(l => l.Scopes).HasForeignKey(s => s.FranchiseLinkId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Organization>().WithMany().HasForeignKey(s => s.FranchisorOrganizationId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Organization>().WithMany().HasForeignKey(s => s.FranchiseeOrganizationId).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(s => new { s.FranchiseLinkId, s.Scope }).IsUnique();
        builder.HasIndex(s => s.FranchiseeOrganizationId);
    }
}
