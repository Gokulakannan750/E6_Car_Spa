using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class ShowroomDailyAttendanceConfiguration : IEntityTypeConfiguration<ShowroomDailyAttendance>
{
    public void Configure(EntityTypeBuilder<ShowroomDailyAttendance> builder)
    {
        builder.ToTable("ShowroomDailyAttendances");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Date)
            .IsRequired();

        builder.Property(a => a.IsAttendanceConfirmed)
            .IsRequired()
            .HasDefaultValue(false);

        builder.HasOne(a => a.Showroom)
            .WithMany()
            .HasForeignKey(a => a.ShowroomId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.AttendanceConfirmedByUser)
            .WithMany()
            .HasForeignKey(a => a.AttendanceConfirmedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(a => new { a.ShowroomId, a.Date })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false");
    }
}
