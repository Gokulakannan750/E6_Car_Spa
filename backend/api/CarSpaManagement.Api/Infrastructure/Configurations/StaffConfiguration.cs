using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class StaffConfiguration : IEntityTypeConfiguration<Staff>
{
 public void Configure(EntityTypeBuilder<Staff> builder)
 {
 builder.ToTable("Staff");

 builder.HasKey(s => s.Id);
 builder.Property(s => s.Id).ValueGeneratedNever();

 builder.Property(s => s.Name)
 .IsRequired()
 .HasMaxLength(100);

 builder.Property(s => s.PhoneNumber)
 .IsRequired()
 .HasMaxLength(15);

 builder.HasIndex(s => s.PhoneNumber)
 .HasDatabaseName("IX_Staff_PhoneNumber");

 builder.Property(s => s.Email)
 .HasMaxLength(100);

 builder.Property(s => s.Address)
 .HasMaxLength(200);

 builder.Property(s => s.Role)
 .HasMaxLength(50);

 builder.Property(s => s.IsActive)
 .HasDefaultValue(true);

 builder.HasMany(s => s.StaffAdvances)
 .WithOne(a => a.Staff)
 .HasForeignKey(a => a.StaffId)
 .OnDelete(DeleteBehavior.Restrict);
 }
}
