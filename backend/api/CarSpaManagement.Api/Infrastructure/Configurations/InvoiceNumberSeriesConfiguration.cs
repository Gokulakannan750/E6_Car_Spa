using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class InvoiceNumberSeriesConfiguration : IEntityTypeConfiguration<InvoiceNumberSeries>
{
    public void Configure(EntityTypeBuilder<InvoiceNumberSeries> builder)
    {
        builder.ToTable("InvoiceNumberSeries", t =>
        {
            t.HasCheckConstraint("CK_InvoiceNumberSeries_NextNumber", "\"NextNumber\" >= 1");
            t.HasCheckConstraint("CK_InvoiceNumberSeries_MinDigits", "\"MinDigits\" BETWEEN 1 AND 9");
            t.HasCheckConstraint("CK_InvoiceNumberSeries_SeriesKind", "\"SeriesKind\" IN ('Gst', 'NonGst')");
        });

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();

        builder.Property(s => s.SeriesKind)
            .HasConversion<string>()
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(s => s.Prefix)
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(s => s.MinDigits)
            .HasDefaultValue(4)
            .IsRequired();

        builder.Property(s => s.NextNumber)
            .HasDefaultValue(1L)
            .IsRequired();

        builder.Property(s => s.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        // Exactly one active series per kind. (Case-insensitive prefix uniqueness is an expression index
        // created in the migration: UX_InvoiceNumberSeries_Prefix on upper("Prefix").)
        builder.HasIndex(s => s.SeriesKind)
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false")
            .HasDatabaseName("UX_InvoiceNumberSeries_SeriesKind");
    }
}
