using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
	public void Configure(EntityTypeBuilder<Invoice> builder)
	{
		builder.ToTable("Invoices");

		builder.HasKey(i => i.Id);
		builder.Property(i => i.Id).ValueGeneratedNever();

		builder.Property(i => i.InvoiceNumber)
			.IsRequired()
			.HasMaxLength(30);

		builder.Property(i => i.InvoiceDate)
			.HasColumnType("date")
			.IsRequired();

		builder.Property(i => i.Subtotal)
			.HasPrecision(18, 2)
			.IsRequired();

		builder.Property(i => i.Discount)
			.HasPrecision(18, 2)
			.IsRequired();

		builder.Property(i => i.TaxableAmount)
			.HasPrecision(18, 2)
			.IsRequired();

		builder.Property(i => i.GstAmount)
			.HasPrecision(18, 2)
			.IsRequired();

		builder.Property(i => i.TotalAmount)
			.HasPrecision(18, 2)
			.IsRequired();

		builder.Property(i => i.PaidAmount)
			.HasPrecision(18, 2)
			.IsRequired();

		builder.Property(i => i.BalanceAmount)
			.HasPrecision(18, 2)
			.IsRequired();

		builder.Property(i => i.Status)
			.IsRequired()
			.HasDefaultValue(InvoiceStatus.Draft);

		builder.Property(i => i.Notes)
			.HasMaxLength(500);

		builder.Property(i => i.IsDeleted)
			.HasDefaultValue(false);

		builder.Property(i => i.CreatedAt)
			.HasDefaultValueSql("CURRENT_TIMESTAMP");

		builder.HasIndex(i => i.InvoiceNumber)
			.IsUnique()
			.HasDatabaseName("UX_Invoices_InvoiceNumber");

		builder.HasIndex(i => new { i.JobCardId, i.Status })
			.HasDatabaseName("IX_Invoices_JobCardId_Status");

		builder.HasIndex(i => new { i.CustomerId, i.Status, i.InvoiceDate })
			.HasDatabaseName("IX_Invoices_CustomerId_Status_InvoiceDate");

		builder.HasIndex(i => new { i.VehicleId, i.Status })
			.HasDatabaseName("IX_Invoices_VehicleId_Status");

		builder.HasIndex(i => new { i.Status, i.InvoiceDate })
			.HasDatabaseName("IX_Invoices_Status_InvoiceDate");

		builder.HasOne(i => i.JobCard)
			.WithMany()
			.HasForeignKey(i => i.JobCardId)
			.OnDelete(DeleteBehavior.Restrict);

		builder.HasOne(i => i.Customer)
			.WithMany()
			.HasForeignKey(i => i.CustomerId)
			.OnDelete(DeleteBehavior.Restrict);

		builder.HasOne(i => i.Vehicle)
			.WithMany()
			.HasForeignKey(i => i.VehicleId)
			.OnDelete(DeleteBehavior.Restrict);

		builder.HasMany(i => i.InvoiceItems)
			.WithOne(ii => ii.Invoice)
			.HasForeignKey(ii => ii.InvoiceId)
			.OnDelete(DeleteBehavior.Cascade);
	}
}
