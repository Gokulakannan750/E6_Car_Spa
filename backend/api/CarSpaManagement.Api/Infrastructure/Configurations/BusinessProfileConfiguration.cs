using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class BusinessProfileConfiguration : IEntityTypeConfiguration<BusinessProfile>
{
    public void Configure(EntityTypeBuilder<BusinessProfile> builder)
    {
        builder.ToTable("BusinessProfiles");

        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id).ValueGeneratedNever();

        builder.Property(b => b.SingletonKey)
            .HasDefaultValue(1)
            .IsRequired();

        builder.HasIndex(b => b.SingletonKey)
            .IsUnique()
            .HasDatabaseName("UX_BusinessProfiles_Singleton");

        builder.Property(b => b.BusinessName)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(b => b.AddressLine1)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(b => b.AddressLine2)
            .HasMaxLength(200);

        builder.Property(b => b.City)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(b => b.State)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(b => b.PostalCode)
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(b => b.Phone)
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(b => b.Email)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(b => b.Gstin)
            .HasMaxLength(20);

        builder.Property(b => b.LogoPath)
            .HasMaxLength(500);

        builder.Property(b => b.InvoicePrefix)
            .HasMaxLength(10)
            .HasDefaultValue("INV")
            .IsRequired();

        builder.Property(b => b.TermsAndConditions)
            .HasMaxLength(2000);

        builder.Property(b => b.Notes)
            .HasMaxLength(1000);
    }
}
