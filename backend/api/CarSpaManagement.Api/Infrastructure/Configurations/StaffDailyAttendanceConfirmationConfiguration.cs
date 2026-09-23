using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class StaffDailyAttendanceConfirmationConfiguration : IEntityTypeConfiguration<StaffDailyAttendanceConfirmation>
{
    public void Configure(EntityTypeBuilder<StaffDailyAttendanceConfirmation> builder)
    {
        builder.ToTable("StaffDailyAttendanceConfirmations");

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();

        builder.Property(c => c.Date)
            .HasColumnType("date")
            .IsRequired();

        builder.HasIndex(c => c.Date)
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("IX_StaffDailyAttendanceConfirmations_Date");

        builder.HasOne(c => c.AttendanceConfirmedByUser)
            .WithMany()
            .HasForeignKey(c => c.AttendanceConfirmedByUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
