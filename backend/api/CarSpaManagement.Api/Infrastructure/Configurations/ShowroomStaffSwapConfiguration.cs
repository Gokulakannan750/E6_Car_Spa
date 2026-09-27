using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class ShowroomStaffSwapConfiguration : IEntityTypeConfiguration<ShowroomStaffSwap>
{
    public void Configure(EntityTypeBuilder<ShowroomStaffSwap> builder)
    {
        builder.ToTable("ShowroomStaffSwaps");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.SwapId)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(s => s.Date)
            .IsRequired();

        builder.Property(s => s.Status)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(s => s.PerformedByName)
            .HasMaxLength(150);

        builder.Property(s => s.CoverageStartTime)
            .HasMaxLength(10);

        builder.Property(s => s.CoverageEndTime)
            .HasMaxLength(10);

        builder.Property(s => s.CoverageDurationHours)
            .HasPrecision(5, 2);

        builder.Property(s => s.Reason)
            .HasMaxLength(500);

        builder.Property(s => s.Notes)
            .HasMaxLength(500);

        builder.HasOne(s => s.StaffA)
            .WithMany()
            .HasForeignKey(s => s.StaffAId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.ShowroomA)
            .WithMany()
            .HasForeignKey(s => s.ShowroomAId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.StaffB)
            .WithMany()
            .HasForeignKey(s => s.StaffBId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.ShowroomB)
            .WithMany()
            .HasForeignKey(s => s.ShowroomBId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.PerformedByUser)
            .WithMany()
            .HasForeignKey(s => s.PerformedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(s => s.SwapId)
            .IsUnique();

        builder.HasIndex(s => new { s.ShowroomAId, s.Date });
        builder.HasIndex(s => new { s.ShowroomBId, s.Date });
        builder.HasIndex(s => new { s.StaffAId, s.Date });
        builder.HasIndex(s => new { s.StaffBId, s.Date });
    }
}
