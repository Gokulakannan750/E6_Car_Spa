using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class ServiceConfiguration : IEntityTypeConfiguration<Service>
{
 public void Configure(EntityTypeBuilder<Service> builder)
 {
 builder.ToTable("Services");

 builder.HasKey(s => s.Id);
 builder.Property(s => s.Id).ValueGeneratedNever();

 builder.Property(s => s.Name)
 .IsRequired()
 .HasMaxLength(100);

 builder.Property(s => s.Description)
 .HasMaxLength(500);

 builder.Property(s => s.Category)
 .HasMaxLength(50);

 builder.Property(s => s.Price)
 .HasColumnType("decimal(18,2)")
 .IsRequired();

 builder.Property(s => s.TaxPercentage)
 .HasColumnType("decimal(5,2)")
 .IsRequired();

 builder.Property(s => s.DurationMinutes);

 builder.Property(s => s.IsActive)
 .HasDefaultValue(true);

 builder.Property(s => s.IsDeleted)
 .HasDefaultValue(false);

 builder.Property(s => s.CreatedAt)
 .HasDefaultValueSql("CURRENT_TIMESTAMP");

 // Indexes
 builder.HasIndex(s => new { s.Name, s.IsDeleted })
 .HasDatabaseName("IX_Services_Name");

 builder.HasIndex(s => new { s.Category, s.IsDeleted })
 .HasDatabaseName("IX_Services_Category");

 builder.HasIndex(s => new { s.IsActive, s.IsDeleted })
 .HasDatabaseName("IX_Services_IsActive_IsDeleted");

 // Relationships
 builder.HasMany(s => s.JobCardServices)
 .WithOne(js => js.Service)
 .HasForeignKey(js => js.ServiceId)
 .OnDelete(DeleteBehavior.Restrict);
 }
}