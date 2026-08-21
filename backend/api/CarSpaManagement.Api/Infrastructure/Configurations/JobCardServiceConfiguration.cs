using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class JobCardServiceConfiguration : IEntityTypeConfiguration<JobCardService>
{
 public void Configure(EntityTypeBuilder<JobCardService> builder)
 {
 builder.ToTable("JobCardServices");

 builder.HasKey(js => js.Id);
 builder.Property(js => js.Id).ValueGeneratedNever();

 builder.Property(js => js.ServiceName)
 .IsRequired()
 .HasMaxLength(100);

 builder.Property(js => js.UnitPrice)
 .HasColumnType("decimal(18,2)")
 .IsRequired();

 builder.Property(js => js.Quantity)
 .IsRequired();

 builder.Property(js => js.TaxPercentage)
 .HasColumnType("decimal(5,2)")
 .IsRequired();

 builder.Property(js => js.DiscountAmount)
 .HasColumnType("decimal(18,2)")
 .IsRequired();

 builder.Property(js => js.LineTotal)
 .HasColumnType("decimal(18,2)")
 .IsRequired();

 builder.Property(js => js.IsDeleted)
 .HasDefaultValue(false);

 builder.Property(js => js.CreatedAt)
 .HasDefaultValueSql("CURRENT_TIMESTAMP");

 // Indexes
 builder.HasIndex(js => new { js.JobCardId, js.ServiceId })
 .HasDatabaseName("IX_JobCardServices_JobCardId_ServiceId");

 builder.HasIndex(js => js.JobCardId)
 .HasDatabaseName("IX_JobCardServices_JobCardId");

 // Relationships
 builder.HasOne(js => js.JobCard)
 .WithMany(j => j.JobCardServices)
 .HasForeignKey(js => js.JobCardId)
 .OnDelete(DeleteBehavior.Cascade);

 builder.HasOne(js => js.Service)
 .WithMany(s => s.JobCardServices)
 .HasForeignKey(js => js.ServiceId)
 .OnDelete(DeleteBehavior.Restrict);
 }
}