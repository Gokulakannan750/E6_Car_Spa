using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class ShowroomVehicleWorkItemConfiguration : IEntityTypeConfiguration<ShowroomVehicleWorkItem>
{
    public void Configure(EntityTypeBuilder<ShowroomVehicleWorkItem> builder)
    {
        builder.ToTable("ShowroomVehicleWorkItems");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Quantity)
            .IsRequired()
            .HasDefaultValue(1);

        builder.Property(i => i.Notes)
            .HasMaxLength(500);

        builder.HasOne(i => i.ShowroomVehicleWork)
            .WithMany(w => w.ServiceItems)
            .HasForeignKey(i => i.ShowroomVehicleWorkId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(i => i.WorkType)
            .WithMany(w => w.WorkItems)
            .HasForeignKey(i => i.WorkTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(i => new { i.ShowroomVehicleWorkId, i.WorkTypeId });
    }
}
