using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class WhatsAppMessageConfiguration : IEntityTypeConfiguration<WhatsAppMessage>
{
	public void Configure(EntityTypeBuilder<WhatsAppMessage> builder)
	{
		builder.ToTable("WhatsAppMessages");

		builder.HasKey(m => m.Id);
		builder.Property(m => m.Id).ValueGeneratedNever();

		builder.Property(m => m.InvoiceId)
			.IsRequired();

		builder.Property(m => m.CustomerId)
			.IsRequired();

		builder.Property(m => m.MessageType)
			.IsRequired();

		builder.Property(m => m.RecipientPhone)
			.HasMaxLength(20)
			.IsRequired();

		builder.Property(m => m.Status)
			.IsRequired();

		builder.Property(m => m.MetaMessageId)
			.HasMaxLength(100);

		builder.Property(m => m.ErrorMessage)
			.HasMaxLength(1000);

		builder.Property(m => m.AttemptCount)
			.HasDefaultValue(0)
			.IsRequired();

		builder.Property(m => m.CreatedAt)
			.HasDefaultValueSql("CURRENT_TIMESTAMP");

		builder.Property(m => m.IsDeleted)
			.HasDefaultValue(false);

		// Unique constraint ensuring at most one active WhatsApp message per MessageType for each Invoice
		builder.HasIndex(m => new { m.InvoiceId, m.MessageType })
			.IsUnique()
			.HasFilter("\"IsDeleted\" = false")
			.HasDatabaseName("UX_WhatsAppMessages_Invoice_MessageType");

		builder.HasIndex(m => m.Status)
			.HasDatabaseName("IX_WhatsAppMessages_Status");

		builder.HasIndex(m => m.NextAttemptAtUtc)
			.HasDatabaseName("IX_WhatsAppMessages_NextAttemptAtUtc");

		// Relationships
		builder.HasOne(m => m.Invoice)
			.WithMany(i => i.WhatsAppMessages)
			.HasForeignKey(m => m.InvoiceId)
			.OnDelete(DeleteBehavior.Cascade);

		builder.HasOne(m => m.Customer)
			.WithMany()
			.HasForeignKey(m => m.CustomerId)
			.OnDelete(DeleteBehavior.Restrict);
	}
}
