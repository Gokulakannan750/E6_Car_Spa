using CarSpaManagement.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSpaManagement.Api.Infrastructure.Configurations;

public class OrganizationCounterConfiguration : IEntityTypeConfiguration<OrganizationCounter>
{
    public void Configure(EntityTypeBuilder<OrganizationCounter> builder)
    {
        builder.ToTable("OrganizationCounters");
        builder.HasKey(c => new { c.OrganizationId, c.Name });
        builder.Property(c => c.Name).HasMaxLength(50).IsRequired();
    }
}
