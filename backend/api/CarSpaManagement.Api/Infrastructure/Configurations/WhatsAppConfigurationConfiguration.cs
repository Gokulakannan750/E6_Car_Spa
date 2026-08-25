using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class WhatsAppConfigurationConfiguration : IEntityTypeConfiguration<WhatsAppConfiguration>
{
	public void Configure(EntityTypeBuilder<WhatsAppConfiguration> builder)
	{
		builder.ToTable("WhatsAppConfigurations");

		builder.HasKey(c => c.Id);
		builder.Property(c => c.Id).ValueGeneratedNever();

		builder.Property(c => c.SingletonKey)
			.HasDefaultValue(1)
			.IsRequired();

		builder.HasIndex(c => c.SingletonKey)
			.IsUnique()
			.HasDatabaseName("UX_WhatsAppConfigurations_Singleton");

		builder.Property(c => c.IsEnabled)
			.HasDefaultValue(false)
			.IsRequired();

		builder.Property(c => c.PhoneNumberId)
			.HasMaxLength(50)
			.IsRequired();

		builder.Property(c => c.BusinessAccountId)
			.HasMaxLength(50)
			.IsRequired();

		builder.Property(c => c.GraphApiVersion)
			.HasMaxLength(20)
			.HasDefaultValue("v25.0")
			.IsRequired();

		builder.Property(c => c.AccessTokenEncrypted)
			.IsRequired(false);

		builder.Property(c => c.InvoiceNotificationsEnabled)
			.HasDefaultValue(true)
			.IsRequired();

		builder.Property(c => c.PaymentCompletedNotificationsEnabled)
			.HasDefaultValue(true)
			.IsRequired();

		builder.Property(c => c.InvoiceTemplateName)
			.HasMaxLength(100)
			.HasDefaultValue("e6_carspa_invoice_generated")
			.IsRequired();

		builder.Property(c => c.InvoiceTemplateLanguage)
			.HasMaxLength(20)
			.HasDefaultValue("en_US")
			.IsRequired();

		builder.Property(c => c.PaymentCompletedTemplateName)
			.HasMaxLength(100)
			.HasDefaultValue("e6_carspa_payment_completed")
			.IsRequired();

		builder.Property(c => c.PaymentCompletedTemplateLanguage)
			.HasMaxLength(20)
			.HasDefaultValue("en_US")
			.IsRequired();
	}
}
