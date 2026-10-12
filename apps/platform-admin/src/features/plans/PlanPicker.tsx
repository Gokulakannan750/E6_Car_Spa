import { Minus, Plus } from 'lucide-react';
import { featureLabel } from '@/lib/catalog';
import { money, moneyShort, perInterval } from '@/lib/format';
import type { AddOn, AddOnPrice, Catalog, PlanVersion } from '@/lib/types';

export interface PlanSelection {
	planCode: string;
	interval: 'Month' | 'Year';
	addOns: Record<string, number>;
}

/** The price version in force now (no end date) for an interval. */
export function currentVersion(versions: PlanVersion[], interval: string): PlanVersion | undefined {
	return versions.filter((v) => v.interval === interval && !v.effectiveTo).sort((a, b) => b.version - a.version)[0];
}

export function currentAddOnPrice(prices: AddOnPrice[], interval: string): AddOnPrice | undefined {
	return prices.filter((p) => p.interval === interval && !p.effectiveTo).sort((a, b) => b.version - a.version)[0];
}

export interface PriceLine {
	label: string;
	detail?: string;
	amountMinor: number;
}

export function priceLines(catalog: Catalog, selection: PlanSelection): { lines: PriceLine[]; totalMinor: number; currency: string } {
	const plan = catalog.plans.find((p) => p.code === selection.planCode);
	const version = plan ? currentVersion(plan.versions, selection.interval) : undefined;
	const lines: PriceLine[] = [];
	if (plan && version) {
		lines.push({ label: `${plan.name} plan`, detail: `${version.includedSeats} users included`, amountMinor: version.priceMinor });
	}
	for (const addOn of catalog.addOns) {
		const qty = selection.addOns[addOn.code] ?? 0;
		const price = currentAddOnPrice(addOn.prices, selection.interval);
		if (qty > 0 && price) {
			lines.push({ label: addOn.name, detail: qty > 1 ? `${qty} × ${moneyShort(price.unitPriceMinor)}` : undefined, amountMinor: price.unitPriceMinor * qty });
		}
	}
	return { lines, totalMinor: lines.reduce((s, l) => s + l.amountMinor, 0), currency: version?.currency ?? 'INR' };
}

/** On/off add-ons (a module) take 0 or 1; packs (more users, more branches) take a quantity. */
function isPack(addOn: AddOn): boolean {
	return addOn.value !== 'true';
}

export function PlanPicker({ catalog, value, onChange }: { catalog: Catalog; value: PlanSelection; onChange: (v: PlanSelection) => void }) {
	const plans = catalog.plans.filter((p) => p.isActive);
	const addOns = catalog.addOns.filter((a) => a.isActive);

	function setQty(code: string, qty: number) {
		const next = { ...value.addOns };
		if (qty <= 0) delete next[code];
		else next[code] = qty;
		onChange({ ...value, addOns: next });
	}

	return (
		<div className="flex flex-col gap-5">
			<fieldset>
				<legend className="mb-2 text-label font-medium text-text-primary">Billing</legend>
				<div className="inline-flex rounded-md border border-border-subtle bg-surface-alt p-0.5" role="radiogroup">
					{(['Month', 'Year'] as const).map((interval) => (
						<button
							key={interval}
							type="button"
							role="radio"
							aria-checked={value.interval === interval}
							onClick={() => onChange({ ...value, interval })}
							className={`h-8 rounded px-4 text-label font-medium ${value.interval === interval ? 'bg-surface-raised text-text-heading' : 'text-text-secondary hover:text-text-heading'}`}
						>
							{interval === 'Month' ? 'Monthly' : 'Yearly'}
						</button>
					))}
				</div>
			</fieldset>

			<fieldset>
				<legend className="mb-2 text-label font-medium text-text-primary">Plan</legend>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup">
					{plans.map((plan) => {
						const version = currentVersion(plan.versions, value.interval);
						const selected = value.planCode === plan.code;
						const features = version?.entitlements.filter((e) => e.value === 'true').map((e) => featureLabel(e.featureKey)) ?? [];
						return (
							<button
								key={plan.code}
								type="button"
								role="radio"
								aria-checked={selected}
								onClick={() => onChange({ ...value, planCode: plan.code })}
								className={`rounded-lg border p-4 text-left transition-colors ${selected ? 'border-action bg-action/10 ring-1 ring-action' : 'border-border-subtle bg-surface-alt hover:border-text-muted'}`}
							>
								<div className="flex items-baseline justify-between gap-2">
									<span className="text-title font-semibold text-text-heading">{plan.name}</span>
									<span className="tabular text-body text-text-heading">
										{version ? moneyShort(version.priceMinor) : '—'}
										<span className="text-label text-text-muted">{perInterval(value.interval)}</span>
									</span>
								</div>
								<div className="mt-1 text-label text-text-secondary">{version ? `${version.includedSeats} users` : 'No price for this billing period'}</div>
								{features.length > 0 && <div className="mt-2 text-micro text-text-muted">{features.join(' · ')}</div>}
							</button>
						);
					})}
				</div>
			</fieldset>

			{addOns.length > 0 && (
				<fieldset>
					<legend className="mb-2 text-label font-medium text-text-primary">Add-ons</legend>
					<ul className="flex flex-col divide-y divide-border-hairline rounded-lg border border-border-subtle bg-surface-alt">
						{addOns.map((addOn) => {
							const price = currentAddOnPrice(addOn.prices, value.interval);
							const qty = value.addOns[addOn.code] ?? 0;
							return (
								<li key={addOn.code} className="flex items-center justify-between gap-3 px-4 py-2.5">
									<div className="min-w-0">
										<div className="text-body text-text-heading">{addOn.name}</div>
										<div className="tabular text-label text-text-muted">
											{price ? `${moneyShort(price.unitPriceMinor)}${perInterval(value.interval)}${isPack(addOn) ? ' each' : ''}` : 'No price for this billing period'}
										</div>
									</div>
									{isPack(addOn) ? (
										<div className="flex items-center gap-1" aria-label={`${addOn.name} quantity`}>
											<button
												type="button"
												aria-label={`Fewer ${addOn.name}`}
												disabled={qty === 0}
												onClick={() => setQty(addOn.code, qty - 1)}
												className="inline-flex size-7 items-center justify-center rounded-md border border-border-subtle text-text-secondary hover:text-text-heading disabled:opacity-40"
											>
												<Minus className="size-3.5" />
											</button>
											<span className="tabular w-8 text-center text-body text-text-heading">{qty}</span>
											<button
												type="button"
												aria-label={`More ${addOn.name}`}
												disabled={!price || qty >= 50}
												onClick={() => setQty(addOn.code, qty + 1)}
												className="inline-flex size-7 items-center justify-center rounded-md border border-border-subtle text-text-secondary hover:text-text-heading disabled:opacity-40"
											>
												<Plus className="size-3.5" />
											</button>
										</div>
									) : (
										<label className="flex items-center gap-2 text-label text-text-secondary">
											<input
												type="checkbox"
												checked={qty > 0}
												disabled={!price}
												onChange={(e) => setQty(addOn.code, e.target.checked ? 1 : 0)}
												className="size-4 accent-[#3b82f6]"
											/>
											Include
										</label>
									)}
								</li>
							);
						})}
					</ul>
				</fieldset>
			)}
		</div>
	);
}

export function PriceSummary({ catalog, selection, title = 'Summary' }: { catalog: Catalog; selection: PlanSelection; title?: string }) {
	const { lines, totalMinor, currency } = priceLines(catalog, selection);
	return (
		<div className="rounded-lg border border-border-subtle bg-surface-alt p-4">
			<div className="mb-3 text-label font-semibold tracking-[0.04em] text-text-muted uppercase">{title}</div>
			<ul className="flex flex-col gap-2.5">
				{lines.map((line) => (
					<li key={line.label} className="flex items-start justify-between gap-3 text-body">
						<div className="min-w-0">
							<div className="text-text-heading">{line.label}</div>
							{line.detail && <div className="text-label text-text-muted">{line.detail}</div>}
						</div>
						<span className="tabular text-text-primary">{money(line.amountMinor, currency)}</span>
					</li>
				))}
			</ul>
			<div className="mt-3 flex items-baseline justify-between border-t border-border-subtle pt-3">
				<span className="text-label font-semibold tracking-[0.04em] text-text-muted uppercase">
					Total {selection.interval === 'Year' ? 'per year' : 'per month'}
				</span>
				<span className="tabular text-headline font-bold text-text-heading">{money(totalMinor, currency)}</span>
			</div>
			{!catalog.chargesGst && <p className="mt-1 text-right text-micro text-text-muted">No GST charged</p>}
		</div>
	);
}
