import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Minus, Plus } from 'lucide-react';
import { Button, Dialog } from '../../components/ui';
import {
	changeOwnerPlan,
	previewOwnerChange,
	type CatalogAddOn,
	type CatalogPlan,
	type LicenceCountsDto,
	type OwnerChangeResultDto,
	type OwnerChoice,
	type OwnerSubscriptionDto,
} from '../../lib/api';
import { cn } from '../../utils/cn';

export const money = (minor: number, currency = 'INR') =>
	new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(minor / 100);

export const shortDate = (value: string) => new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

const LICENCES: { key: keyof LicenceCountsDto; label: string; priceKey: 'bothUserPriceMinor' | 'windowsUserPriceMinor' | 'androidUserPriceMinor' }[] = [
	{ key: 'both', label: 'Windows + Android', priceKey: 'bothUserPriceMinor' },
	{ key: 'windows', label: 'Windows only', priceKey: 'windowsUserPriceMinor' },
	{ key: 'android', label: 'Android only', priceKey: 'androidUserPriceMinor' },
];

/** Whether the plan already includes what a module add-on switches on (then it is not sold separately). */
export function planIncludes(plan: CatalogPlan | undefined, addOn: CatalogAddOn) {
	return !addOn.isPack && !!plan?.modules.includes(addOn.featureKey);
}

const addOnPrice = (a: CatalogAddOn, interval: OwnerChoice['interval']) => (interval === 'Year' ? a.yearlyPriceMinor : a.monthlyPriceMinor);

/** The add-ons to send: not those the chosen plan already includes, nor ones without a price for the interval. */
function addOnsFor(choice: OwnerChoice, plan: CatalogPlan | undefined, addOns: CatalogAddOn[]) {
	return Object.fromEntries(
		Object.entries(choice.addOns).filter(([code, qty]) => {
			const a = addOns.find((x) => x.code === code);
			return qty > 0 && a && !planIncludes(plan, a) && addOnPrice(a, choice.interval) != null;
		}),
	);
}

function Stepper({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (v: number) => void }) {
	return (
		<div className="inline-flex items-center rounded-md border border-slate-300">
			<button type="button" aria-label={`Fewer ${label} licences`} className="px-2 py-1 disabled:opacity-40" disabled={value <= min} onClick={() => onChange(value - 1)}>
				<Minus className="h-3.5 w-3.5" />
			</button>
			<span className="w-8 text-center text-sm font-semibold tabular-nums" aria-label={`${label} licences`}>
				{value}
			</span>
			<button type="button" aria-label={`More ${label} licences`} className="px-2 py-1" onClick={() => onChange(value + 1)}>
				<Plus className="h-3.5 w-3.5" />
			</button>
		</div>
	);
}

/**
 * The Owner changes plan, billing, user licences and add-ons. The server works out the price and when it starts:
 * an upgrade now (the rest of the paid period invoiced), a downgrade at the period end with no refund.
 */
export function ChangePlanDialog({
	open,
	onClose,
	data,
	onChanged,
}: {
	open: boolean;
	onClose: () => void;
	data: OwnerSubscriptionDto;
	onChanged: (result: OwnerChangeResultDto) => void;
}) {
	const { catalog, current, licencesInUse } = data;
	const [choice, setChoice] = useState<OwnerChoice>(current);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setChoice(current);
			setError(null);
		}
	}, [open, current]);

	const plan = catalog.plans.find((p) => p.code === choice.planCode);
	const prices = plan ? (choice.interval === 'Year' ? plan.yearly : plan.monthly) : null;
	const wanted = useMemo<OwnerChoice>(
		() => ({ ...choice, addOns: addOnsFor(choice, plan, catalog.addOns) }),
		[choice, plan, catalog.addOns],
	);
	const total = wanted.licences.android + wanted.licences.windows + wanted.licences.both;
	const unchanged = JSON.stringify(wanted) === JSON.stringify({ ...current, addOns: addOnsFor(current, catalog.plans.find((p) => p.code === current.planCode), catalog.addOns) });
	const valid = !!prices && total >= (plan?.minimumLicences ?? 1);

	const preview = useQuery({
		queryKey: ['owner-plan-preview', wanted],
		queryFn: () => previewOwnerChange(wanted),
		enabled: open && valid && !unchanged,
		retry: false,
	});

	async function confirm() {
		setSaving(true);
		setError(null);
		try {
			onChanged(await changeOwnerPlan(wanted));
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
		} finally {
			setSaving(false);
		}
	}

	const setLicence = (key: keyof LicenceCountsDto, value: number) => setChoice((c) => ({ ...c, licences: { ...c.licences, [key]: value } }));
	const setAddOn = (code: string, qty: number) => setChoice((c) => ({ ...c, addOns: { ...c.addOns, [code]: qty } }));
	const per = choice.interval === 'Year' ? '/yr' : '/mo';

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => !o && onClose()}
			title="Change plan"
			description="Choose your plan, user licences and add-ons. You see the price before anything changes."
			size="2xl"
			footer={
				<div className="flex w-full items-center justify-end gap-2">
					<Button variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={confirm} loading={saving} disabled={!valid || unchanged || preview.isFetching || preview.isError}>
						{preview.data?.timing === 'NowWithCharge' ? `Upgrade and pay ${money(preview.data.amountNowMinor, preview.data.currency)}` : 'Confirm change'}
					</Button>
				</div>
			}
		>
			<div className="space-y-5">
				<div className="flex items-center gap-2">
					{(['Month', 'Year'] as const).map((interval) => (
						<button
							key={interval}
							type="button"
							aria-pressed={choice.interval === interval}
							onClick={() => setChoice((c) => ({ ...c, interval }))}
							className={cn(
								'rounded-md border px-3 py-1.5 text-sm font-semibold',
								choice.interval === interval ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-600',
							)}
						>
							{interval === 'Month' ? 'Monthly' : 'Yearly'}
						</button>
					))}
				</div>

				<fieldset className="grid gap-3 md:grid-cols-2">
					<legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</legend>
					{catalog.plans.map((p) => {
						const pr = choice.interval === 'Year' ? p.yearly : p.monthly;
						return (
							<label
								key={p.code}
								className={cn(
									'flex cursor-pointer items-start gap-3 rounded-lg border p-3',
									choice.planCode === p.code ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200',
									!pr && 'cursor-not-allowed opacity-50',
								)}
							>
								<input
									type="radio"
									name="plan"
									disabled={!pr}
									checked={choice.planCode === p.code}
									onChange={() => setChoice((c) => ({ ...c, planCode: p.code }))}
									className="mt-1"
								/>
								<span>
									<span className="block text-sm font-bold text-slate-900">{p.name}</span>
									<span className="block text-xs text-slate-500">
										{pr ? `from ${money(Math.min(...[pr.androidUserPriceMinor, pr.windowsUserPriceMinor, pr.bothUserPriceMinor].filter((v) => v > 0)))} per user${per}` : 'Not sold this way'}
									</span>
								</span>
							</label>
						);
					})}
				</fieldset>

				<div>
					<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">User licences</p>
					<div className="space-y-2">
						{LICENCES.map((l) => (
							<div key={l.key} className="flex items-center justify-between gap-3">
								<div>
									<p className="text-sm font-medium text-slate-800">{l.label}</p>
									<p className="text-xs text-slate-500">
										{prices ? `${money(prices[l.priceKey])} per user${per}` : ''} · {licencesInUse[l.key]} in use
									</p>
								</div>
								<Stepper label={l.label} value={choice.licences[l.key]} min={licencesInUse[l.key]} onChange={(v) => setLicence(l.key, v)} />
							</div>
						))}
					</div>
					<p className="mt-1 text-xs text-slate-500">You cannot go below the users who have that licence. Change users in Users &amp; Access first.</p>
				</div>

				<div>
					<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Add-ons</p>
					<div className="space-y-2">
						{catalog.addOns.map((a) => {
							const included = planIncludes(plan, a);
							const price = addOnPrice(a, choice.interval);
							const qty = choice.addOns[a.code] ?? 0;
							return (
								<div key={a.code} className="flex items-center justify-between gap-3">
									<div>
										<p className="text-sm font-medium text-slate-800">{a.name}</p>
										<p className="text-xs text-slate-500">
											{included ? `Included in ${plan?.name}` : price != null ? `${money(price)}${per}${a.isPack ? ' each' : ''}` : 'Not sold this way'}
										</p>
									</div>
									{!included && price != null && (a.isPack ? (
										<Stepper label={a.name} value={qty} min={0} onChange={(v) => setAddOn(a.code, v)} />
									) : (
										<input type="checkbox" aria-label={a.name} checked={qty > 0} onChange={(e) => setAddOn(a.code, e.target.checked ? 1 : 0)} />
									))}
								</div>
							);
						})}
					</div>
				</div>

				<div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700" data-testid="owner-change-preview">
					{unchanged ? (
						'Change something above to see the price.'
					) : !valid ? (
						`Choose at least ${plan?.minimumLicences ?? 1} user licence.`
					) : preview.isFetching ? (
						'Working out the price…'
					) : preview.isError ? (
						<span className="text-red-700">{preview.error.message}</span>
					) : preview.data ? (
						<>
							<p className="font-semibold text-slate-900">
								New price: {money(preview.data.newPeriodPriceMinor, preview.data.currency)}
								{per} (now {money(preview.data.currentPeriodPriceMinor, preview.data.currency)}
								{per})
							</p>
							<p className="mt-1">
								{preview.data.timing === 'NowWithCharge' &&
									`It starts now. You pay ${money(preview.data.amountNowMinor, preview.data.currency)} today: the difference for the rest of your paid period.`}
								{preview.data.timing === 'AtPeriodEnd' &&
									`It starts on ${shortDate(preview.data.effectiveAt)}, when your paid period ends. Nothing is refunded; your renewal uses the new price.`}
								{preview.data.timing === 'Now' && 'It starts now. Nothing to pay today; your next invoice uses the new price.'}
							</p>
							{data.catalog.chargesGst && <p className="mt-1 text-xs text-slate-500">GST is added on the invoice.</p>}
						</>
					) : null}
				</div>
				{error && (
					<p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
						{error}
					</p>
				)}
			</div>
		</Dialog>
	);
}
