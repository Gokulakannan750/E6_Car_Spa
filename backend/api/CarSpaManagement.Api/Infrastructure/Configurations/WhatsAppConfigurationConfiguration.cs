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

		builder.HasIndex(c => new { c.OrganizationId, c.SingletonKey })
			.IsUnique()
			.HasDatabaseName("UX_WhatsAppConfigurations_Singleton");

		builder.Property(c => c.IsEnabled)
			.HasDefaultValue(false)
			.IsRequired();

		builder.Property(c => c.PhoneNumberId)
			.HasMaxLength(50)
			.IsRequired();

		// A WhatsApp number can be connected to only one company on the platform: Meta's incoming-message events
		// name the number, and the number is how they are routed to the right company. Unconfigured rows are empty.
		builder.HasIndex(c => c.PhoneNumberId)
			.IsUnique()
			.HasFilter("\"PhoneNumberId\" <> ''")
			.HasDatabaseName("UX_WhatsAppConfigurations_PhoneNumberId");

		builder.Property(c => c.BusinessAccountId)
			.HasMaxLength(50)
			.IsRequired();

		builder.Property(c => c.MetaAppId)
			.HasMaxLength(50);

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
			.HasDefaultValue("invoice_generated")
			.IsRequired();

		builder.Property(c => c.InvoiceTemplateLanguage)
			.HasMaxLength(20)
			.HasDefaultValue("en")
			.IsRequired();

		builder.Property(c => c.PaymentCompletedTemplateName)
			.HasMaxLength(100)
			.HasDefaultValue("payment_completed")
			.IsRequired();

		builder.Property(c => c.PaymentCompletedTemplateLanguage)
			.HasMaxLength(20)
			.HasDefaultValue("en_US")
			.IsRequired();

		builder.Property(c => c.HealthStatus)
			.HasConversion<string>()
			.HasMaxLength(50)
			.HasDefaultValue(CarSpaManagement.Api.Domain.Enums.WhatsAppHealthStatus.NotConfigured)
			.IsRequired();

		builder.Property(c => c.LastCheckedAtUtc)
			.IsRequired(false);

		builder.Property(c => c.LastSuccessAtUtc)
			.IsRequired(false);

		builder.Property(c => c.LastFailureAtUtc)
			.IsRequired(false);

		builder.Property(c => c.LastErrorMessage)
			.HasMaxLength(500)
			.IsRequired(false);
	}
}
