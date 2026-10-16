import { useProducts } from '@/features/products/ProductProvider';
import { Lightbulb, Minus, Plus } from 'lucide-react';
import { seatTypes, featureLabel, totalSeats } from '@/lib/catalog';
import { money, moneyShort, perInterval } from '@/lib/format';
import type { AddOn, AddOnPrice, Catalog, Product, SeatQuantities, PlanVersion } from '@/lib/types';

export interface PlanSelection {
	planCode: string;
	interval: 'Month' | 'Year';
	addOns: Record<string, number>;
	seats: SeatQuantities;
}

export function initialSeats(product?: Product): SeatQuantities {
	// The portal sends explicit choices; no implicit product-specific seat codes.
	const types = seatTypes(product);
	return Object.fromEntries(types.map((t, index) => [t.code, (types.some((t) => t.defaultSeat) ? t.defaultSeat : index === 0) ? 1 : 0]));
}

/** The price version in force now (no end date) for an interval. */
export function currentVersion(versions: PlanVersion[], interval: string): PlanVersion | undefined {
	return versions.filter((v) => v.interval === interval && !v.effectiveTo).sort((a, b) => b.version - a.version)[0];
}

export function minimumSeats(catalog: Catalog | undefined, selection: PlanSelection, product?: Product): number {
	if (product?.seatModel === 'None') return 0;
	const plan = catalog?.plans.find((p) => p.code === selection.planCode);
	return Math.max(1, plan ? (currentVersion(plan.versions, selection.interval)?.includedSeats ?? 1) : 1);
}

export function currentAddOnPrice(prices: AddOnPrice[], interval: string): AddOnPrice | undefined {
	return prices.filter((p) => p.interval === interval && !p.effectiveTo).sort((a, b) => b.version - a.version)[0];
}

export function seatPrice(version: PlanVersion, code: string): number {
	return version.seats.find((s) => s.code === code)?.priceMinor ?? 0;
}
function cheapestSeat(version: PlanVersion): number | null {
	const prices = version.seats.map((s) => s.priceMinor).filter((p) => p > 0);
	return prices.length ? Math.min(...prices) : null;
}

/** Whether a plan version already includes what a module add-on would switch on (it cannot be bought again). */
export function planIncludes(version: PlanVersion | undefined, addOn: AddOn): boolean {
	return !!version && addOn.value === 'true' && version.entitlements.some((e) => e.featureKey === addOn.featureKey && e.value === 'true');
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
		if (version.priceMinor > 0) lines.push({ label: `${plan.name} company fee`, amountMinor: version.priceMinor });
		for (const type of version.seats) {
			const count = selection.seats[type.code] ?? 0;
			if (count > 0) {
				const unit = seatPrice(version, type.code);
				lines.push({ label: `${type.name} seat`, detail: `${count} × ${moneyShort(unit)} · ${plan.name}`, amountMinor: unit * count });
			}
		}
	}
	for (const addOn of catalog.addOns) {
		const qty = selection.addOns[addOn.code] ?? 0;
		const price = currentAddOnPrice(addOn.prices, selection.interval);
		if (qty > 0 && price && !planIncludes(version, addOn)) {
			lines.push({ label: addOn.name, detail: qty > 1 ? `${qty} × ${moneyShort(price.unitPriceMinor)}` : undefined, amountMinor: price.unitPriceMinor * qty });
		}
	}
	return { lines, totalMinor: lines.reduce((s, l) => s + l.amountMinor, 0), currency: version?.currency ?? 'INR' };
}

/**
 * When another active plan includes some of the chosen module add-ons and would cost less with the same seats,
 * that plan and its total; otherwise null. Used for the "upgrading is cheaper" hint.
 */
export function cheaperPlan(catalog: Catalog, selection: PlanSelection): { name: string; code: string; totalMinor: number } | null {
	const current = priceLines(catalog, selection).totalMinor;
	let best: { name: string; code: string; totalMinor: number } | null = null;
	for (const plan of catalog.plans.filter((p) => p.isActive && p.code !== selection.planCode)) {
		const version = currentVersion(plan.versions, selection.interval);
		if (!version) continue;
		const chosen = Object.keys(selection.addOns)
			.map((code) => catalog.addOns.find((a) => a.code === code))
			.filter((a): a is AddOn => !!a);
		if (!chosen.some((a) => planIncludes(version, a))) continue;
		const addOns = Object.fromEntries(Object.entries(selection.addOns).filter(([code]) => !chosen.some((a) => a.code === code && planIncludes(version, a))));
		const total = priceLines(catalog, { ...selection, planCode: plan.code, addOns }).totalMinor;
		if (total < current && (!best || total < best.totalMinor)) best = { name: plan.name, code: plan.code, totalMinor: total };
	}
	return best;
}

/** On/off add-ons (a module) take 0 or 1; packs (more branches) take a quantity. */
function isPack(addOn: AddOn): boolean {
	return addOn.value !== 'true';
}

function Stepper({ label, value, onChange, min = 0, max = 500 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
	return (
		<div className="flex items-center gap-1">
			<button
				type="button"
				aria-label={`Fewer ${label}`}
				disabled={value <= min}
				onClick={() => onChange(value - 1)}
				className="inline-flex size-7 items-center justify-center rounded-md border border-border-subtle text-text-secondary hover:text-text-heading disabled:opacity-40"
			>
				<Minus className="size-3.5" />
			</button>
			<input
				aria-label={label}
				inputMode="numeric"
				value={value}
				onChange={(e) => {
					const n = Number(e.target.value.replace(/\D/g, '') || '0');
					onChange(Math.min(max, Math.max(min, n)));
				}}
				className="tabular h-7 w-12 rounded-md border border-border-subtle bg-surface-alt text-center text-body text-text-heading focus:border-action focus:outline-none"
			/>
			<button
				type="button"
				aria-label={`More ${label}`}
				disabled={value >= max}
				onClick={() => onChange(value + 1)}
				className="inline-flex size-7 items-center justify-center rounded-md border border-border-subtle text-text-secondary hover:text-text-heading disabled:opacity-40"
			>
				<Plus className="size-3.5" />
			</button>
		</div>
	);
}

export function PlanPicker({ catalog, value, onChange, product: supplied }: { catalog: Catalog; value: PlanSelection; onChange: (v: PlanSelection) => void; product?: Product }) {
	const { product: selected } = useProducts();
	const product = supplied ?? selected;
	const types = seatTypes(product);
	const plans = catalog.plans.filter((p) => p.isActive || p.code === value.planCode);
	const plan = catalog.plans.find((p) => p.code === value.planCode);
	const version = plan ? currentVersion(plan.versions, value.interval) : undefined;
	const addOns = catalog.addOns.filter((a) => a.isActive || (value.addOns[a.code] ?? 0) > 0);
	const minimum = product?.seatModel === 'None' ? 0 : Math.max(1, version?.includedSeats ?? 1);

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
					{plans.map((p) => {
						const v = currentVersion(p.versions, value.interval);
						const selected = value.planCode === p.code;
						const from = v ? cheapestSeat(v) : null;
						const features = v?.entitlements.filter((e) => e.value === 'true').map((e) => featureLabel(e.featureKey, product)) ?? [];
						return (
							<button
								key={p.code}
								type="button"
								role="radio"
								aria-checked={selected}
								onClick={() => onChange({ ...value, planCode: p.code })}
								className={`rounded-lg border p-4 text-left transition-colors ${selected ? 'border-action bg-action/10 ring-1 ring-action' : 'border-border-subtle bg-surface-alt hover:border-text-muted'}`}
							>
								<div className="flex items-baseline justify-between gap-2">
									<span className="text-title font-semibold text-text-heading">{p.name}</span>
									<span className="tabular text-label text-text-secondary">
										{from !== null ? (
											<>
												from {moneyShort(from)}
												<span className="text-text-muted">/user{perInterval(value.interval)}</span>
											</>
										) : v ? (
											moneyShort(v.priceMinor)
										) : (
											'—'
										)}
									</span>
								</div>
								<div className="mt-2 text-micro text-text-muted">{features.length > 0 ? features.join(' · ') : 'No additional features'}</div>
							</button>
						);
					})}
				</div>
			</fieldset>

			{product?.seatModel === 'None' ? (
				<p className="text-body text-text-secondary">Unlimited seats</p>
			) : (
				<fieldset>
					<legend className="mb-1 text-label font-medium text-text-primary">Seats</legend>
					<p className="mb-2 text-micro text-text-muted">
						Choose at least {minimum} seat{minimum === 1 ? '' : 's'}.
					</p>
					<ul className="flex flex-col divide-y divide-border-hairline rounded-lg border border-border-subtle bg-surface-alt">
						{types.map((type) => (
							<li key={type.code} className="flex items-center justify-between gap-3 px-4 py-2.5">
								<div className="min-w-0">
									<div className="text-body text-text-heading">{type.name}</div>
									<div className="tabular text-label text-text-muted">
										{version ? `${moneyShort(seatPrice(version, type.code))} per user${perInterval(value.interval)}` : 'No price for this billing period'}
									</div>
								</div>
								<Stepper label={`${type.name} licences`} value={value.seats[type.code] ?? 0} onChange={(n) => onChange({ ...value, seats: { ...value.seats, [type.code]: n } })} />
							</li>
						))}
					</ul>
					{totalSeats(value.seats) < minimum && (
						<p role="alert" className="mt-2 text-label text-danger">
							Add at least {minimum} seat{minimum === 1 ? '' : 's'}.
						</p>
					)}
				</fieldset>
			)}

			{addOns.length > 0 && (
				<fieldset>
					<legend className="mb-2 text-label font-medium text-text-primary">Add-ons</legend>
					<ul className="flex flex-col divide-y divide-border-hairline rounded-lg border border-border-subtle bg-surface-alt">
						{addOns.map((addOn) => {
							const price = currentAddOnPrice(addOn.prices, value.interval);
							const qty = value.addOns[addOn.code] ?? 0;
							const included = planIncludes(version, addOn);
							return (
								<li key={addOn.code} className="flex items-center justify-between gap-3 px-4 py-2.5">
									<div className="min-w-0">
										<div className={`text-body ${included ? 'text-text-muted' : 'text-text-heading'}`}>
											{addOn.name}
											{!addOn.isActive && <span className="ml-2 text-micro text-text-muted">(no longer sold)</span>}
										</div>
										<div className="tabular text-label text-text-muted">
											{included
												? `Included in ${plan?.name ?? 'this plan'}`
												: price
													? `${moneyShort(price.unitPriceMinor)}${perInterval(value.interval)}${isPack(addOn) ? ' each' : ''}`
													: 'No price for this billing period'}
										</div>
									</div>
									{included ? null : isPack(addOn) ? (
										<Stepper label={addOn.name} value={qty} max={50} onChange={(n) => setQty(addOn.code, n)} />
									) : (
										<label className="flex items-center gap-2 text-label text-text-secondary">
											<input
												type="checkbox"
												aria-label={`Include ${addOn.name}`}
												checked={qty > 0}
												disabled={!price || (!addOn.isActive && qty === 0)}
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

/** The add-ons to send to the API: modules the plan already includes are left out (the API refuses them). */
export function addOnsToBuy(catalog: Catalog, selection: PlanSelection): Record<string, number> {
	const plan = catalog.plans.find((p) => p.code === selection.planCode);
	const version = plan ? currentVersion(plan.versions, selection.interval) : undefined;
	return Object.fromEntries(
		Object.entries(selection.addOns).filter(([code, qty]) => {
			const addOn = catalog.addOns.find((a) => a.code === code);
			return qty > 0 && addOn && !planIncludes(version, addOn);
		}),
	);
}

export function PriceSummary({ catalog, selection, title = 'Summary' }: { catalog: Catalog; selection: PlanSelection; title?: string }) {
	const { lines, totalMinor, currency } = priceLines(catalog, selection);
	const cheaper = cheaperPlan(catalog, selection);
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
				<span className="text-label font-semibold tracking-[0.04em] text-text-muted uppercase">Total {selection.interval === 'Year' ? 'per year' : 'per month'}</span>
				<span className="tabular text-headline font-bold text-text-heading">{money(totalMinor, currency)}</span>
			</div>
			{!catalog.chargesGst && <p className="mt-1 text-right text-micro text-text-muted">No GST charged</p>}
			{cheaper && (
				<p role="status" className="mt-3 flex items-start gap-2 rounded-md border border-active/30 bg-active-bg px-3 py-2 text-label text-text-primary">
					<Lightbulb className="mt-px size-3.5 shrink-0 text-active" aria-hidden />
					<span>
						{cheaper.name} includes these modules and would cost <span className="tabular font-semibold">{money(cheaper.totalMinor, currency)}</span> with the same seats.
					</span>
				</p>
			)}
		</div>
	);
}
