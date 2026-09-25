using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class ShowroomStaffWorkSessionConfiguration : IEntityTypeConfiguration<ShowroomStaffWorkSession>
{
    public void Configure(EntityTypeBuilder<ShowroomStaffWorkSession> builder)
    {
        builder.ToTable("ShowroomStaffWorkSessions");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Date)
            .IsRequired();

        builder.Property(s => s.SessionType)
            .IsRequired();

        builder.Property(s => s.AttendanceStatus)
            .IsRequired();

        builder.Property(s => s.StartTime)
            .HasMaxLength(10);

        builder.Property(s => s.EndTime)
            .HasMaxLength(10);

        builder.Property(s => s.TransferReason)
            .HasMaxLength(255);

        builder.Property(s => s.Notes)
            .HasMaxLength(500);

        builder.HasOne(s => s.Staff)
            .WithMany(st => st.ShowroomWorkSessions)
            .HasForeignKey(s => s.StaffId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.HomeShowroom)
            .WithMany()
            .HasForeignKey(s => s.HomeShowroomId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.WorkingShowroom)
            .WithMany()
            .HasForeignKey(s => s.WorkingShowroomId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(s => new { s.WorkingShowroomId, s.Date });
        builder.HasIndex(s => new { s.StaffId, s.Date });
    }
}
