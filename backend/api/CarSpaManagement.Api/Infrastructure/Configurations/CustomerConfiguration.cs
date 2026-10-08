using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
 public void Configure(EntityTypeBuilder<Customer> builder)
 {
 builder.ToTable("Customers");

 builder.HasKey(c => c.Id);
 builder.Property(c => c.Id).ValueGeneratedNever();

 builder.Property(c => c.Name)
 .IsRequired()
 .HasMaxLength(100);

 builder.Property(c => c.PhoneNumber)
 .IsRequired()
 .HasMaxLength(20);

 builder.HasIndex(c => c.PhoneNumber)
 .HasDatabaseName("IX_Customers_PhoneNumber");

 builder.Property(c => c.Email)
 .HasMaxLength(100);

 builder.Property(c => c.Address)
 .HasMaxLength(500);

 builder.Property(c => c.IsDeleted)
 .HasDefaultValue(false);

 builder.Property(c => c.CreatedAt)
 .HasDefaultValueSql("CURRENT_TIMESTAMP");

 // Relationships
 builder.HasMany(c => c.Vehicles)
 .WithOne(v => v.Customer)
 .HasForeignKey(v => v.CustomerId)
 .OnDelete(DeleteBehavior.Restrict);

 builder.HasMany(c => c.JobCards)
 .WithOne(j => j.Customer)
 .HasForeignKey(j => j.CustomerId)
 .OnDelete(DeleteBehavior.Restrict);
 }
}