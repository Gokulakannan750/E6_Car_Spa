using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
	public void Configure(EntityTypeBuilder<Payment> builder)
	{
		builder.ToTable("Payments");

		builder.HasKey(p => p.Id);
		builder.Property(p => p.Id).ValueGeneratedNever();

		builder.Property(p => p.Amount)
			.HasPrecision(18, 2)
			.IsRequired();

		builder.Property(p => p.PaymentMethod)
			.IsRequired();

		builder.Property(p => p.Reference)
			.HasMaxLength(100);

		builder.Property(p => p.PaymentDate)
			.IsRequired();

		builder.Property(p => p.IsDeleted)
			.HasDefaultValue(false);

		builder.Property(p => p.CreatedAt)
			.HasDefaultValueSql("CURRENT_TIMESTAMP");

		builder.HasIndex(p => p.InvoiceId)
			.HasDatabaseName("IX_Payments_InvoiceId");

		builder.HasIndex(p => p.PaymentDate)
			.HasDatabaseName("IX_Payments_PaymentDate");

		builder.HasOne(p => p.Invoice)
			.WithMany(i => i.Payments)
			.HasForeignKey(p => p.InvoiceId)
			.OnDelete(DeleteBehavior.Cascade);
	}
}
