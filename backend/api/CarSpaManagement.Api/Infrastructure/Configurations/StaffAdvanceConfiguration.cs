using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class StaffAdvanceConfiguration : IEntityTypeConfiguration<StaffAdvance>
{
 public void Configure(EntityTypeBuilder<StaffAdvance> builder)
 {
 builder.ToTable("StaffAdvances");

 builder.HasKey(a => a.Id);
 builder.Property(a => a.Id).ValueGeneratedNever();

 builder.Property(a => a.StaffId)
 .IsRequired();

 builder.Property(a => a.StaffName)
 .IsRequired()
 .HasMaxLength(100);

 builder.Property(a => a.StaffRole)
 .HasMaxLength(50);

 builder.Property(a => a.AdvanceType)
 .IsRequired()
 .HasMaxLength(20);

 builder.Property(a => a.Description)
 .HasMaxLength(500);

 builder.Property(a => a.Amount)
 .HasColumnType("decimal(18,2)")
 .IsRequired();

 builder.Property(a => a.AdvanceDate)
 .HasColumnType("date")
 .IsRequired();

 builder.Property(a => a.PaymentMethod)
 .HasMaxLength(50);

 builder.Property(a => a.Status)
 .HasMaxLength(20)
 .HasDefaultValue("Pending");

 builder.Property(a => a.Notes)
 .HasMaxLength(500);

 // Indexes
 builder.HasIndex(a => a.StaffId)
 .HasDatabaseName("IX_StaffAdvances_StaffId");

 builder.HasIndex(a => a.AdvanceDate)
 .HasDatabaseName("IX_StaffAdvances_AdvanceDate");

 builder.HasIndex(a => a.Status)
 .HasDatabaseName("IX_StaffAdvances_Status");

 // Relationships — Staff is optional here; if Staff is deleted, advance keeps its StaffId
 builder.HasOne(a => a.Staff)
 .WithMany(s => s.StaffAdvances)
 .HasForeignKey(a => a.StaffId)
 .OnDelete(DeleteBehavior.Restrict);
 }
}
