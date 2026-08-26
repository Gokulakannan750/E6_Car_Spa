using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class InvoicePublicLinkConfiguration : IEntityTypeConfiguration<InvoicePublicLink>
{
    public void Configure(EntityTypeBuilder<InvoicePublicLink> builder)
    {
        builder.ToTable("InvoicePublicLinks");

        builder.HasKey(l => l.Id);
        builder.Property(l => l.Id).ValueGeneratedNever();

        builder.Property(l => l.InvoiceId)
            .IsRequired();

        builder.Property(l => l.TokenHash)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(l => l.CreatedAtUtc)
            .IsRequired();

        builder.Property(l => l.CreatedByUserId)
            .IsRequired(false);

        builder.Property(l => l.LastAccessedAtUtc)
            .IsRequired(false);

        builder.Property(l => l.AccessCount)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(l => l.IsRevoked)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(l => l.RevokedAtUtc)
            .IsRequired(false);

        builder.Property(l => l.RevokedByUserId)
            .IsRequired(false);

        builder.Property(l => l.ExpiresAtUtc)
            .IsRequired(false);

        builder.Property(l => l.IsDeleted)
            .HasDefaultValue(false);

        builder.Property(l => l.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        // Indexes
        builder.HasIndex(l => l.TokenHash)
            .IsUnique()
            .HasDatabaseName("UX_InvoicePublicLinks_TokenHash");

        builder.HasIndex(l => l.InvoiceId)
            .HasDatabaseName("IX_InvoicePublicLinks_InvoiceId");

        builder.HasIndex(l => l.IsRevoked)
            .HasDatabaseName("IX_InvoicePublicLinks_IsRevoked");

        // Relationship
        builder.HasOne(l => l.Invoice)
            .WithMany(i => i.PublicLinks)
            .HasForeignKey(l => l.InvoiceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
