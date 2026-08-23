using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class InvoiceItemConfiguration : IEntityTypeConfiguration<InvoiceItem>
{
	public void Configure(EntityTypeBuilder<InvoiceItem> builder)
	{
		builder.ToTable("InvoiceItems");

		builder.HasKey(ii => ii.Id);
		builder.Property(ii => ii.Id).ValueGeneratedNever();

		builder.Property(ii => ii.ServiceId);

		builder.Property(ii => ii.Description)
			.IsRequired()
			.HasMaxLength(100);

		builder.Property(ii => ii.Quantity)
			.IsRequired();

		builder.Property(ii => ii.UnitPrice)
			.HasPrecision(18, 2)
			.IsRequired();

		builder.Property(ii => ii.Discount)
			.HasPrecision(18, 2)
			.IsRequired();

		builder.Property(ii => ii.TaxableAmount)
			.HasPrecision(18, 2)
			.IsRequired();

		builder.Property(ii => ii.TaxAmount)
			.HasPrecision(18, 2)
			.IsRequired();

		builder.Property(ii => ii.TotalAmount)
			.HasPrecision(18, 2)
			.IsRequired();

		builder.Property(ii => ii.IsDeleted)
			.HasDefaultValue(false);

		builder.Property(ii => ii.CreatedAt)
			.HasDefaultValueSql("CURRENT_TIMESTAMP");

		builder.HasIndex(ii => new { ii.InvoiceId, ii.ServiceId })
			.HasDatabaseName("IX_InvoiceItems_InvoiceId_ServiceId");

		builder.HasIndex(ii => ii.InvoiceId)
			.HasDatabaseName("IX_InvoiceItems_InvoiceId");

		builder.HasIndex(ii => ii.ServiceId)
			.HasDatabaseName("IX_InvoiceItems_ServiceId");

		builder.HasOne(ii => ii.Invoice)
			.WithMany(i => i.InvoiceItems)
			.HasForeignKey(ii => ii.InvoiceId)
			.OnDelete(DeleteBehavior.Cascade);

		builder.HasOne(ii => ii.Service)
			.WithMany()
			.HasForeignKey(ii => ii.ServiceId)
			.OnDelete(DeleteBehavior.Restrict);
	}
}
