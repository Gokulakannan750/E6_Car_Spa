using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class JobCardConfiguration : IEntityTypeConfiguration<JobCard>
{
 public void Configure(EntityTypeBuilder<JobCard> builder)
 {
 builder.ToTable("JobCards");

 builder.HasKey(j => j.Id);
 builder.Property(j => j.Id).ValueGeneratedNever();

 builder.Property(j => j.JobCardNumber)
 .IsRequired()
 .HasMaxLength(30);

 builder.Property(j => j.Status)
 .IsRequired()
 .HasDefaultValue(JobCardStatus.Draft);

 builder.Property(j => j.Subtotal)
 .HasColumnType("decimal(18,2)")
 .IsRequired();

 builder.Property(j => j.TaxAmount)
 .HasColumnType("decimal(18,2)")
 .IsRequired();

 builder.Property(j => j.DiscountAmount)
 .HasColumnType("decimal(18,2)")
 .IsRequired();

 builder.Property(j => j.TotalAmount)
 .HasColumnType("decimal(18,2)")
 .IsRequired();

 builder.Property(j => j.IsDeleted)
 .HasDefaultValue(false);

 builder.Property(j => j.CreatedAt)
 .HasDefaultValueSql("CURRENT_TIMESTAMP");

 // Unique constraint on JobCardNumber
 builder.HasIndex(j => j.JobCardNumber)
 .IsUnique()
 .HasDatabaseName("UX_JobCards_JobCardNumber");

 // Indexes
 builder.HasIndex(j => new { j.CustomerId, j.Status, j.CreatedAt })
 .HasDatabaseName("IX_JobCards_CustomerId_Status_CreatedAt");

 builder.HasIndex(j => new { j.VehicleId, j.Status })
 .HasDatabaseName("IX_JobCards_VehicleId_Status");

 builder.HasIndex(j => new { j.Status, j.CreatedAt })
 .HasDatabaseName("IX_JobCards_Status_CreatedAt");

 // Relationships
 builder.HasOne(j => j.Customer)
 .WithMany(c => c.JobCards)
 .HasForeignKey(j => j.CustomerId)
 .OnDelete(DeleteBehavior.Restrict);

 builder.HasOne(j => j.Vehicle)
 .WithMany(v => v.JobCards)
 .HasForeignKey(j => j.VehicleId)
 .OnDelete(DeleteBehavior.Restrict);

 builder.HasMany(j => j.JobCardServices)
 .WithOne(js => js.JobCard)
 .HasForeignKey(js => js.JobCardId)
 .OnDelete(DeleteBehavior.Cascade);
 }
}