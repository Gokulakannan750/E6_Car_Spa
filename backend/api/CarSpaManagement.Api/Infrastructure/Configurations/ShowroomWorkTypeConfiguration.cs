using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class ShowroomWorkTypeConfiguration : IEntityTypeConfiguration<ShowroomWorkType>
{
    public void Configure(EntityTypeBuilder<ShowroomWorkType> builder)
    {
        builder.ToTable("ShowroomWorkTypes");

        builder.HasKey(w => w.Id);

        builder.Property(w => w.Code)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(w => w.Name)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(w => w.Description)
            .HasMaxLength(255);

        builder.Property(w => w.DisplayOrder)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(w => w.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.HasIndex(w => w.Code)
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false");
    }
}
