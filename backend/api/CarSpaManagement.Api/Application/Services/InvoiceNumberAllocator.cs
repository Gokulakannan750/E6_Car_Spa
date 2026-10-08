using CarSpaManagement.Api.Application.Common;
using CarSpaManagement.Api.Domain.Entities;
using CarSpaManagement.Api.Domain.Enums;
using CarSpaManagement.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace CarSpaManagement.Api.Application.Services;

/// <summary>
/// The single authority for issuing invoice numbers.
///
/// Invariant: a number recorded in InvoiceNumberAllocations has been issued and is never issued again
/// (automatic or manual, under any prefix). GST and non-GST invoices use independent series rows, so
/// they lock different rows and never block each other.
/// </summary>
public class InvoiceNumberAllocator(AppDbContext db)
{
	public const string DefaultGstPrefix = "GST/";
	public const string DefaultNonGstPrefix = "BILL/";
	public const int DefaultMinDigits = 4;

	public static InvoiceSeriesKind KindFor(Invoice invoice) =>
		invoice.IsGstEnabled ? InvoiceSeriesKind.Gst : InvoiceSeriesKind.NonGst;

	/// <summary>
	/// Issues the next automatic number for the invoice's series and assigns it. MUST be called inside the
	/// finalization transaction: the series row stays locked until commit, and the counter and ledger row
	/// roll back with the transaction if finalization fails (no number is consumed).
	/// </summary>
	public async Task<string> AllocateAutomaticAsync(Invoice invoice, CancellationToken cancellationToken = default)
	{
		var kind = KindFor(invoice);
		var series = await LockSeriesAsync(kind, cancellationToken);

		var counter = series.NextNumber;
		string candidate;
		while (true)
		{
			candidate = InvoiceNumberRules.FormatSeriesNumber(series.Prefix, series.MinDigits, counter);
			if (!await IsConsumedAsync(candidate, null, cancellationToken))
				break;
			counter++; // already issued (e.g. manually reserved by the Owner, or under a previous prefix)
		}

		db.InvoiceNumberAllocations.Add(new InvoiceNumberAllocation
		{
			InvoiceId = invoice.Id,
			InvoiceNumber = candidate,
			NormalizedNumber = InvoiceNumberRules.ReservationKey(candidate),
			SeriesKind = kind,
			AllocationType = InvoiceNumberAllocationType.Automatic,
			CounterValue = counter,
			AllocatedAtUtc = DateTime.UtcNow,
		});
		series.NextNumber = counter + 1;
		series.UpdatedAt = DateTime.UtcNow;
		invoice.InvoiceNumber = candidate;
		return candidate;
	}

	/// <summary>
	/// True when the number has ever been issued to an invoice other than <paramref name="exceptInvoiceId"/>
	/// (case-insensitive). Checks the permanent ledger, plus current invoice numbers as a safety net.
	/// </summary>
	public async Task<bool> IsConsumedAsync(string invoiceNumber, Guid? exceptInvoiceId, CancellationToken cancellationToken = default)
	{
		var key = InvoiceNumberRules.ReservationKey(invoiceNumber);
		var reserved = await db.InvoiceNumberAllocations.AnyAsync(
			a => a.NormalizedNumber == key && (exceptInvoiceId == null || a.InvoiceId != exceptInvoiceId),
			cancellationToken);
		if (reserved) return true;

		return await db.Invoices.IgnoreQueryFilters([AppDbContext.SoftDeleteFilter]).AnyAsync(
			i => i.InvoiceNumber != null && i.InvoiceNumber.ToUpper() == key && (exceptInvoiceId == null || i.Id != exceptInvoiceId),
			cancellationToken);
	}

	/// <summary>
	/// Records a number chosen by the Owner, and makes sure the number it replaces stays reserved.
	/// Re-using one of this invoice's own earlier numbers does not add a second reservation.
	/// </summary>
	public async Task ReserveManualAsync(Invoice invoice, string newNumber, Guid? userId, CancellationToken cancellationToken = default)
	{
		var kind = KindFor(invoice);
		var now = DateTime.UtcNow;

		if (!string.IsNullOrWhiteSpace(invoice.InvoiceNumber))
		{
			var oldKey = InvoiceNumberRules.ReservationKey(invoice.InvoiceNumber);
			if (!await db.InvoiceNumberAllocations.AnyAsync(a => a.NormalizedNumber == oldKey, cancellationToken))
			{
				db.InvoiceNumberAllocations.Add(new InvoiceNumberAllocation
				{
					InvoiceId = invoice.Id,
					InvoiceNumber = invoice.InvoiceNumber.Trim(),
					NormalizedNumber = oldKey,
					SeriesKind = kind,
					AllocationType = InvoiceNumberAllocationType.Legacy,
					AllocatedAtUtc = now,
				});
			}
		}

		var newKey = InvoiceNumberRules.ReservationKey(newNumber);
		if (!await db.InvoiceNumberAllocations.AnyAsync(a => a.NormalizedNumber == newKey && a.InvoiceId == invoice.Id, cancellationToken))
		{
			db.InvoiceNumberAllocations.Add(new InvoiceNumberAllocation
			{
				InvoiceId = invoice.Id,
				InvoiceNumber = newNumber,
				NormalizedNumber = newKey,
				SeriesKind = kind,
				AllocationType = InvoiceNumberAllocationType.Manual,
				AllocatedAtUtc = now,
				AllocatedByUserId = userId,
			});
		}
	}

	/// <summary>The number the series would issue next (skipping reserved numbers). Read-only preview; no lock.</summary>
	public async Task<(long Counter, string Number)> PreviewNextAsync(InvoiceNumberSeries series, CancellationToken cancellationToken = default)
	{
		var counter = series.NextNumber;
		while (true)
		{
			var candidate = InvoiceNumberRules.FormatSeriesNumber(series.Prefix, series.MinDigits, counter);
			if (!await IsConsumedAsync(candidate, null, cancellationToken))
				return (counter, candidate);
			counter++;
		}
	}

	/// <summary>Both series rows, creating any missing one with defaults (fresh or in-memory databases).</summary>
	public async Task<List<InvoiceNumberSeries>> GetOrCreateSeriesAsync(CancellationToken cancellationToken = default)
	{
		var all = await db.InvoiceNumberSeries.OrderBy(s => s.SeriesKind).ToListAsync(cancellationToken);
		var created = false;
		foreach (var kind in new[] { InvoiceSeriesKind.Gst, InvoiceSeriesKind.NonGst })
		{
			if (all.Any(s => s.SeriesKind == kind)) continue;
			var series = CreateDefault(kind);
			db.InvoiceNumberSeries.Add(series);
			all.Add(series);
			created = true;
		}
		if (created) await db.SaveChangesAsync(cancellationToken);
		return all.OrderBy(s => s.SeriesKind).ToList();
	}

	/// <summary>Locks the series row for the current transaction (PostgreSQL FOR UPDATE) and returns fresh values.</summary>
	public async Task<InvoiceNumberSeries> LockSeriesAsync(InvoiceSeriesKind kind, CancellationToken cancellationToken = default)
	{
		var isRelational = db.Database.IsRelational();
		if (isRelational)
		{
			await db.Database.ExecuteSqlInterpolatedAsync(
				$"SELECT 1 FROM \"InvoiceNumberSeries\" WHERE \"SeriesKind\" = {kind.ToString()} AND NOT \"IsDeleted\" FOR UPDATE",
				cancellationToken);
		}

		var series = await db.InvoiceNumberSeries.FirstOrDefaultAsync(s => s.SeriesKind == kind, cancellationToken);
		if (series is null)
		{
			series = CreateDefault(kind);
			db.InvoiceNumberSeries.Add(series);
			await db.SaveChangesAsync(cancellationToken); // unique index guards a concurrent first insert
			if (isRelational)
			{
				await db.Database.ExecuteSqlInterpolatedAsync(
					$"SELECT 1 FROM \"InvoiceNumberSeries\" WHERE \"Id\" = {series.Id} FOR UPDATE", cancellationToken);
			}
		}
		else if (isRelational)
		{
			await db.Entry(series).ReloadAsync(cancellationToken); // values committed by the previous lock holder
		}
		return series;
	}

	private static InvoiceNumberSeries CreateDefault(InvoiceSeriesKind kind) => new()
	{
		SeriesKind = kind,
		Prefix = kind == InvoiceSeriesKind.Gst ? DefaultGstPrefix : DefaultNonGstPrefix,
		MinDigits = DefaultMinDigits,
		NextNumber = 1,
		CreatedAt = DateTime.UtcNow,
	};
}
