using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class ShowroomVehicleTypeConfiguration : IEntityTypeConfiguration<ShowroomVehicleType>
{
    public void Configure(EntityTypeBuilder<ShowroomVehicleType> builder)
    {
        builder.ToTable("ShowroomVehicleTypes");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Code)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(t => t.Name)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(t => t.DisplayOrder)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(t => t.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.HasIndex(t => t.Code)
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false");
    }
}
