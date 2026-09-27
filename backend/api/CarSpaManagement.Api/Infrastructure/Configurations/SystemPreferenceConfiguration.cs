using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class SystemPreferenceConfiguration : IEntityTypeConfiguration<SystemPreference>
{
    public void Configure(EntityTypeBuilder<SystemPreference> builder)
    {
        builder.ToTable("SystemPreferences");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();

        builder.Property(s => s.SingletonKey)
            .HasDefaultValue(1)
            .IsRequired();

        builder.HasIndex(s => s.SingletonKey)
            .IsUnique()
            .HasDatabaseName("UX_SystemPreferences_Singleton");

        builder.Property(s => s.DateFormat)
            .HasMaxLength(20)
            .HasDefaultValue("DD/MM/YYYY")
            .IsRequired();

        builder.Property(s => s.TimeFormat)
            .HasMaxLength(10)
            .HasDefaultValue("12h")
            .IsRequired();

        builder.Property(s => s.CurrencySymbol)
            .HasMaxLength(10)
            .HasDefaultValue("₹")
            .IsRequired();

        builder.Property(s => s.DecimalPrecision)
            .HasDefaultValue(2)
            .IsRequired();

        builder.Property(s => s.DefaultPrintCopies)
            .HasDefaultValue(1)
            .IsRequired();

        builder.Property(s => s.AutoPrintReceipt)
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(s => s.RefreshInterval)
            .HasDefaultValue(30)
            .IsRequired();
    }
}
