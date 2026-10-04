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

        builder.Property(w => w.IsOther)
            .IsRequired()
            .HasDefaultValue(false);

        // Names are unique case-insensitively among non-deleted rows via the expression index
        // UX_ShowroomWorkTypes_Name, created in SQL by migration AddShowroomTypeNameUniqueAndIsOther.

        builder.HasIndex(w => w.Code)
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false");
    }
}
