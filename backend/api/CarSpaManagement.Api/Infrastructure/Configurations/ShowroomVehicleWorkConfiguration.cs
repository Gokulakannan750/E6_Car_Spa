using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class ShowroomVehicleWorkConfiguration : IEntityTypeConfiguration<ShowroomVehicleWork>
{
    public void Configure(EntityTypeBuilder<ShowroomVehicleWork> builder)
    {
        builder.ToTable("ShowroomVehicleWorks");

        builder.HasKey(w => w.Id);

        builder.Property(w => w.Date)
            .IsRequired();

        builder.Property(w => w.VehicleQuantity)
            .IsRequired()
            .HasDefaultValue(1);

        builder.Property(w => w.TimeRecorded)
            .HasMaxLength(10);

        builder.Property(w => w.Notes)
            .HasMaxLength(500);

        builder.HasOne(w => w.Showroom)
            .WithMany()
            .HasForeignKey(w => w.ShowroomId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(w => w.Staff)
            .WithMany(s => s.ShowroomVehicleWorks)
            .HasForeignKey(w => w.StaffId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(w => w.VehicleType)
            .WithMany(t => t.VehicleWorks)
            .HasForeignKey(w => w.VehicleTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(w => w.ShowroomStaffWorkSession)
            .WithMany(s => s.VehicleWorks)
            .HasForeignKey(w => w.ShowroomStaffWorkSessionId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(w => new { w.ShowroomId, w.Date });
        builder.HasIndex(w => new { w.StaffId, w.Date });
    }
}
