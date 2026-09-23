using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class StaffSalarySettlementConfiguration : IEntityTypeConfiguration<StaffSalarySettlement>
{
    public void Configure(EntityTypeBuilder<StaffSalarySettlement> builder)
    {
        builder.ToTable("StaffSalarySettlements");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();

        builder.Property(s => s.StaffId)
            .IsRequired();

        builder.Property(s => s.PeriodFrom)
            .HasColumnType("date")
            .IsRequired();

        builder.Property(s => s.PeriodTo)
            .HasColumnType("date")
            .IsRequired();

        builder.Property(s => s.EnteredSalary)
            .HasColumnType("decimal(18,2)")
            .IsRequired();

        builder.Property(s => s.OutstandingAdvanceBeforeSettlement)
            .HasColumnType("decimal(18,2)")
            .IsRequired();

        builder.Property(s => s.AdvanceDeduction)
            .HasColumnType("decimal(18,2)")
            .IsRequired();

        builder.Property(s => s.RemainingAdvanceAfterSettlement)
            .HasColumnType("decimal(18,2)")
            .IsRequired();

        builder.Property(s => s.FinalSalary)
            .HasColumnType("decimal(18,2)")
            .IsRequired();

        builder.Property(s => s.Status)
            .HasConversion(
                v => v.ToString(),
                v => v == "Settled" ? StaffSalaryStatus.Settled : StaffSalaryStatus.Ready)
            .HasMaxLength(20)
            .HasDefaultValue(StaffSalaryStatus.Ready);

        builder.Property(s => s.SettledAt)
            .HasColumnType("timestamp with time zone");

        builder.Property(s => s.Notes)
            .HasMaxLength(500);

        // Indexes
        builder.HasIndex(s => new { s.StaffId, s.PeriodFrom, s.PeriodTo })
            .HasDatabaseName("IX_StaffSalarySettlements_StaffId_PeriodFrom_PeriodTo")
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false");

        builder.HasIndex(s => s.PeriodFrom)
            .HasDatabaseName("IX_StaffSalarySettlements_PeriodFrom");

        builder.HasIndex(s => s.PeriodTo)
            .HasDatabaseName("IX_StaffSalarySettlements_PeriodTo");

        builder.HasIndex(s => s.Status)
            .HasDatabaseName("IX_StaffSalarySettlements_Status");

        // Relationships
        builder.HasOne(s => s.Staff)
            .WithMany()
            .HasForeignKey(s => s.StaffId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.SettledByUser)
            .WithMany()
            .HasForeignKey(s => s.SettledByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(s => s.RecoveredAdvances)
            .WithOne(a => a.StaffSalarySettlement)
            .HasForeignKey(a => a.StaffSalarySettlementId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
