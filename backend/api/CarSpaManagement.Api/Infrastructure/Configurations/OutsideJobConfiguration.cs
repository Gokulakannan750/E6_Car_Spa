using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class OutsideJobConfiguration : IEntityTypeConfiguration<OutsideJob>
{
    public void Configure(EntityTypeBuilder<OutsideJob> builder)
    {
        builder.ToTable("OutsideJobs");

        builder.HasKey(o => o.Id);
        builder.Property(o => o.Id).ValueGeneratedNever();

        builder.Property(o => o.ServiceName)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(o => o.Status)
            .IsRequired()
            .HasDefaultValue(OutsideJobStatus.Outside);

        builder.Property(o => o.SentAt)
            .IsRequired()
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.Property(o => o.ExpectedReturnAt)
            .IsRequired();

        builder.Property(o => o.SentByUserName)
            .HasMaxLength(100);

        builder.Property(o => o.ReturnedByUserName)
            .HasMaxLength(100);

        builder.Property(o => o.VendorCost)
            .HasColumnType("decimal(18,2)");

        builder.Property(o => o.Notes)
            .HasMaxLength(1000);

        builder.Property(o => o.ReturnNotes)
            .HasMaxLength(1000);

        builder.Property(o => o.CancellationReason)
            .HasMaxLength(500);

        builder.Property(o => o.IsDeleted)
            .HasDefaultValue(false);

        builder.Property(o => o.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        // Relationships
        builder.HasOne(o => o.JobCard)
            .WithMany(j => j.OutsideJobs)
            .HasForeignKey(o => o.JobCardId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(o => o.Vehicle)
            .WithMany()
            .HasForeignKey(o => o.VehicleId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(o => o.Customer)
            .WithMany()
            .HasForeignKey(o => o.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(o => o.Vendor)
            .WithMany(v => v.OutsideJobs)
            .HasForeignKey(o => o.VendorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(o => o.Service)
            .WithMany()
            .HasForeignKey(o => o.ServiceId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(o => new { o.JobCardId, o.Status })
            .HasDatabaseName("IX_OutsideJobs_JobCardId_Status");

        builder.HasIndex(o => new { o.VehicleId, o.Status })
            .HasDatabaseName("IX_OutsideJobs_VehicleId_Status");

        builder.HasIndex(o => new { o.VendorId, o.Status })
            .HasDatabaseName("IX_OutsideJobs_VendorId_Status");

        builder.HasIndex(o => new { o.ExpectedReturnAt, o.Status })
            .HasDatabaseName("IX_OutsideJobs_ExpectedReturnAt_Status");

        builder.HasIndex(o => o.SentAt)
            .HasDatabaseName("IX_OutsideJobs_SentAt");
    }
}
