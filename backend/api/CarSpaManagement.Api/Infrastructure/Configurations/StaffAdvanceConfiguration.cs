using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class StaffAdvanceConfiguration : IEntityTypeConfiguration<StaffAdvance>
{
    public void Configure(EntityTypeBuilder<StaffAdvance> builder)
    {
        builder.ToTable("StaffAdvances");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();

        builder.Property(a => a.StaffId)
            .IsRequired();

        builder.Property(a => a.Amount)
            .HasColumnType("decimal(18,2)")
            .IsRequired();

        builder.Property(a => a.AdvanceDate)
            .HasColumnType("date")
            .IsRequired();

        builder.Property(a => a.Reason)
            .HasMaxLength(200);

        builder.Property(a => a.Notes)
            .HasMaxLength(500);

        builder.Property(a => a.Status)
            .HasConversion(
                v => v.ToString(),
                v => v == "Settled" ? StaffAdvanceStatus.Settled
                   : v == "Obsolete" ? StaffAdvanceStatus.Obsolete
                   : StaffAdvanceStatus.Outstanding)
            .HasMaxLength(20)
            .HasDefaultValue(StaffAdvanceStatus.Outstanding);

        builder.Property(a => a.SettledAt)
            .HasColumnType("timestamp with time zone");

        builder.Property(a => a.ObsoletedAt)
            .HasColumnType("timestamp with time zone");

        builder.Property(a => a.ObsoleteReason)
            .HasMaxLength(500);

        // Legacy columns
        builder.Property(a => a.StaffName).HasMaxLength(100);
        builder.Property(a => a.StaffRole).HasMaxLength(50);
        builder.Property(a => a.AdvanceType).HasMaxLength(50);
        builder.Property(a => a.Description).HasMaxLength(500);
        builder.Property(a => a.PaymentMethod).HasMaxLength(50);

        // Indexes
        builder.HasIndex(a => a.StaffId)
            .HasDatabaseName("IX_StaffAdvances_StaffId");

        builder.HasIndex(a => a.AdvanceDate)
            .HasDatabaseName("IX_StaffAdvances_AdvanceDate");

        builder.HasIndex(a => a.Status)
            .HasDatabaseName("IX_StaffAdvances_Status");

        // Relationships
        builder.HasOne(a => a.Staff)
            .WithMany(s => s.StaffAdvances)
            .HasForeignKey(a => a.StaffId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(a => a.SettledByUser)
            .WithMany()
            .HasForeignKey(a => a.SettledByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(a => a.ObsoletedByUser)
            .WithMany()
            .HasForeignKey(a => a.ObsoletedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
