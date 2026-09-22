using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class StaffAttendanceConfiguration : IEntityTypeConfiguration<StaffAttendance>
{
    public void Configure(EntityTypeBuilder<StaffAttendance> builder)
    {
        builder.ToTable("StaffAttendances");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();

        builder.Property(a => a.StaffId)
            .IsRequired();

        builder.Property(a => a.AttendanceDate)
            .HasColumnType("date")
            .IsRequired();

        builder.Property(a => a.Status)
            .HasConversion(
                v => v.ToString(),
                v => v == "HalfDay" ? StaffAttendanceStatus.HalfDay
                   : v == "Leave" || v == "Absent" ? StaffAttendanceStatus.Leave
                   : StaffAttendanceStatus.Present)
            .HasMaxLength(20)
            .HasDefaultValue(StaffAttendanceStatus.Present);

        builder.Property(a => a.CheckInTime)
            .HasMaxLength(10);

        builder.Property(a => a.CheckOutTime)
            .HasMaxLength(10);

        builder.Property(a => a.Notes)
            .HasMaxLength(500);

        // Unique constraint per staff member per business date
        builder.HasIndex(a => new { a.StaffId, a.AttendanceDate })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_StaffAttendances_StaffId_AttendanceDate_Unique");

        builder.HasIndex(a => a.AttendanceDate)
            .HasDatabaseName("IX_StaffAttendances_AttendanceDate");

        builder.HasIndex(a => a.StaffId)
            .HasDatabaseName("IX_StaffAttendances_StaffId");

        builder.HasIndex(a => a.Status)
            .HasDatabaseName("IX_StaffAttendances_Status");

        builder.HasOne(a => a.Staff)
            .WithMany(s => s.Attendances)
            .HasForeignKey(a => a.StaffId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(a => a.CreatedByUser)
            .WithMany()
            .HasForeignKey(a => a.CreatedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(a => a.UpdatedByUser)
            .WithMany()
            .HasForeignKey(a => a.UpdatedByUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
