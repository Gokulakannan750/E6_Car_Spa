using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
    public void Configure(EntityTypeBuilder<Organization> builder)
    {
        builder.ToTable("Organizations");

        builder.Property(o => o.FranchiseAddOnEnabled).HasDefaultValue(false).IsRequired();
        builder.Property(o => o.Code).HasMaxLength(20).IsRequired();
        builder.Property(o => o.Name).HasMaxLength(150).IsRequired();

        // The company code is how people sign in, so it is unique across the platform.
        builder.HasIndex(o => o.Code)
            .IsUnique()
            .HasDatabaseName("UX_Organizations_Code");
    }
}
