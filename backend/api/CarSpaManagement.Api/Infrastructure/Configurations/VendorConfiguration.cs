using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class VendorConfiguration : IEntityTypeConfiguration<Vendor>
{
    public void Configure(EntityTypeBuilder<Vendor> builder)
    {
        builder.ToTable("Vendors");

        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).ValueGeneratedNever();

        builder.Property(v => v.Name)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(v => v.Phone)
            .HasMaxLength(20);

        builder.Property(v => v.ContactPerson)
            .HasMaxLength(100);

        builder.Property(v => v.Address)
            .HasMaxLength(500);

        builder.Property(v => v.ServiceSpecialty)
            .HasMaxLength(100);

        builder.Property(v => v.IsActive)
            .HasDefaultValue(true);

        builder.Property(v => v.IsDeleted)
            .HasDefaultValue(false);

        builder.Property(v => v.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        // Indexes
        builder.HasIndex(v => v.Name)
            .HasDatabaseName("IX_Vendors_Name");

        builder.HasIndex(v => v.IsActive)
            .HasDatabaseName("IX_Vendors_IsActive");
    }
}
