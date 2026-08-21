using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class VehicleConfiguration : IEntityTypeConfiguration<Vehicle>
{
 public void Configure(EntityTypeBuilder<Vehicle> builder)
 {
 builder.ToTable("Vehicles");

 builder.HasKey(v => v.Id);
 builder.Property(v => v.Id).ValueGeneratedNever();

 builder.Property(v => v.RegistrationNumber)
 .IsRequired()
 .HasMaxLength(20);

 builder.Property(v => v.Make)
 .IsRequired()
 .HasMaxLength(50);

 builder.Property(v => v.Model)
 .IsRequired()
 .HasMaxLength(50);

 builder.Property(v => v.Variant)
 .HasMaxLength(50);

 builder.Property(v => v.Color)
 .HasMaxLength(30);

 builder.Property(v => v.IsDeleted)
 .HasDefaultValue(false);

 builder.Property(v => v.CreatedAt)
 .HasDefaultValueSql("CURRENT_TIMESTAMP");

 // Indexes
 builder.HasIndex(v => v.RegistrationNumber)
 .HasDatabaseName("IX_Vehicles_RegistrationNumber");

 builder.HasIndex(v => new { v.CustomerId, v.RegistrationNumber })
 .HasDatabaseName("IX_Vehicles_CustomerId_RegistrationNumber");

 builder.HasIndex(v => new { v.CustomerId, v.IsDeleted })
 .HasDatabaseName("IX_Vehicles_CustomerId_IsDeleted");

 // Relationships
 builder.HasOne(v => v.Customer)
 .WithMany(c => c.Vehicles)
 .HasForeignKey(v => v.CustomerId)
 .OnDelete(DeleteBehavior.Restrict);

 builder.HasMany(v => v.JobCards)
 .WithOne(j => j.Vehicle)
 .HasForeignKey(j => j.VehicleId)
 .OnDelete(DeleteBehavior.Restrict);
 }
}