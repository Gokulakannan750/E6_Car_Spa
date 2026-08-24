using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("AuditLogs");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();

        builder.Property(a => a.TimestampUtc)
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.Property(a => a.UserId);

        builder.Property(a => a.UserName)
            .HasMaxLength(150);

        builder.Property(a => a.UserRole)
            .HasMaxLength(50);

        builder.Property(a => a.Action)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(a => a.Module)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(a => a.EntityType)
            .HasMaxLength(100);

        builder.Property(a => a.EntityId);

        builder.Property(a => a.EntityReference)
            .HasMaxLength(150);

        builder.Property(a => a.Description)
            .HasMaxLength(2000)
            .IsRequired();

        builder.Property(a => a.OldValues)
            .HasColumnType("text");

        builder.Property(a => a.NewValues)
            .HasColumnType("text");

        builder.Property(a => a.Metadata)
            .HasColumnType("text");

        builder.Property(a => a.IpAddress)
            .HasMaxLength(100);

        builder.Property(a => a.Outcome)
            .HasMaxLength(50)
            .HasDefaultValue("Success")
            .IsRequired();

        builder.Property(a => a.CreatedAt)
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        // Database Indexes for high-performance querying
        builder.HasIndex(a => a.TimestampUtc)
            .HasDatabaseName("IX_AuditLogs_TimestampUtc");

        builder.HasIndex(a => a.UserId)
            .HasDatabaseName("IX_AuditLogs_UserId");

        builder.HasIndex(a => a.Module)
            .HasDatabaseName("IX_AuditLogs_Module");

        builder.HasIndex(a => a.Action)
            .HasDatabaseName("IX_AuditLogs_Action");

        builder.HasIndex(a => new { a.EntityType, a.EntityId })
            .HasDatabaseName("IX_AuditLogs_EntityType_EntityId");
    }
}
