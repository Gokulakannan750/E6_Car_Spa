using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class InvoiceNumberAllocationConfiguration : IEntityTypeConfiguration<InvoiceNumberAllocation>
{
    public void Configure(EntityTypeBuilder<InvoiceNumberAllocation> builder)
    {
        builder.ToTable("InvoiceNumberAllocations", t =>
        {
            t.HasCheckConstraint("CK_InvoiceNumberAllocations_SeriesKind", "\"SeriesKind\" IN ('Gst', 'NonGst')");
            t.HasCheckConstraint("CK_InvoiceNumberAllocations_AllocationType", "\"AllocationType\" IN ('Legacy', 'Automatic', 'Manual')");
            t.HasCheckConstraint("CK_InvoiceNumberAllocations_Normalized", "\"NormalizedNumber\" = upper(btrim(\"InvoiceNumber\"))");
        });

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();

        builder.Property(a => a.InvoiceNumber).HasMaxLength(30).IsRequired();
        builder.Property(a => a.NormalizedNumber).HasMaxLength(30).IsRequired();

        builder.Property(a => a.SeriesKind).HasConversion<string>().HasMaxLength(10).IsRequired();
        builder.Property(a => a.AllocationType).HasConversion<string>().HasMaxLength(10).IsRequired();

        builder.Property(a => a.AllocatedAtUtc)
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        // The permanent reservation: a number can be issued only once, ever (case-insensitive).
        builder.HasIndex(a => new { a.OrganizationId, a.NormalizedNumber })
            .IsUnique()
            .HasDatabaseName("UX_InvoiceNumberAllocations_NormalizedNumber");

        builder.HasIndex(a => a.InvoiceId)
            .HasDatabaseName("IX_InvoiceNumberAllocations_InvoiceId");

        // Intentionally no matching soft-delete query filter: reservations of soft-deleted invoices must stay visible
        // (EF logs a benign warning about the filtered principal for this reason).
        builder.HasOne(a => a.Invoice)
            .WithMany()
            .HasForeignKey(a => a.InvoiceId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
