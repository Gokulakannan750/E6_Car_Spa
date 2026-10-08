using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

/// <summary>
/// Looks up the GST rate of every catalogue-service line on a draft invoice, for <see cref="InvoiceCalculator.ApplyToInvoice"/>.
/// The job-card line's own rate wins; where it is 0 the service's catalogue rate is used (see
/// <see cref="InvoiceCalculator.ResolveServiceRate"/>). Soft-deleted services still resolve to their configured rate.
/// </summary>
public static class InvoiceTaxRates
{
	public static async Task<IReadOnlyDictionary<Guid, decimal>> ForDraftAsync(
		AppDbContext db, Invoice invoice, IEnumerable<Domain.Entities.JobCardService>? jobCardLines, CancellationToken cancellationToken = default)
	{
		var serviceIds = invoice.InvoiceItems
			.Where(i => !i.IsDeleted && i.ServiceId.HasValue && !i.OutsideJobId.HasValue)
			.Select(i => i.ServiceId!.Value)
			.Distinct()
			.ToList();
		if (serviceIds.Count == 0) return new Dictionary<Guid, decimal>();

		var jobCardRates = (jobCardLines ?? Enumerable.Empty<Domain.Entities.JobCardService>())
			.Where(l => !l.IsDeleted)
			.GroupBy(l => l.ServiceId)
			.ToDictionary(g => g.Key, g => g.First().TaxPercentage);

		var catalogueRates = await db.Services.IgnoreQueryFilters([AppDbContext.SoftDeleteFilter]).AsNoTracking()
			.Where(s => serviceIds.Contains(s.Id))
			.ToDictionaryAsync(s => s.Id, s => s.TaxPercentage, cancellationToken);

		var rates = new Dictionary<Guid, decimal>();
		foreach (var serviceId in serviceIds)
		{
			var lineRate = jobCardRates.GetValueOrDefault(serviceId);
			if (lineRate > 0)
				rates[serviceId] = lineRate;
			else if (catalogueRates.TryGetValue(serviceId, out var catalogueRate))
				rates[serviceId] = InvoiceCalculator.ResolveServiceRate(lineRate, catalogueRate);
			// else: no rate known → ApplyToInvoice reports it instead of guessing one.
		}
		return rates;
	}
}
