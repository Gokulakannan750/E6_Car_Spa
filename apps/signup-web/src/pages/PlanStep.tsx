import { useProduct, usePaths } from '@/state/product';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Lightbulb } from 'lucide-react';
import { Page, Steps } from '@/components/Frame';
import { Alert, Button, Card, Quantity } from '@/components/ui';

import { featureName } from '@/lib/featureNames';
import { money, moneyShort } from '@/lib/format';
import { totalSeats, seatMinimum, cheapestLicence, freeMonthsLabel, isBusinessComplete, per, pricesFor, yearlyFreeMonths } from '@/lib/rules';
import type { Interval, PlanChoice, PublicCatalog, Quote } from '@/lib/types';
import { useSignup } from '@/state/signup';

/** Waits until the customer stops clicking before asking the server for the price. */
function useDebounced<T>(value: T, ms = 250): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const t = window.setTimeout(() => setDebounced(value), ms);
		return () => window.clearTimeout(t);
	}, [value, ms]);
	return debounced;
}

export function PlanStep() {
	const { api, catalog: definition, brand: links } = useProduct();
	const paths = usePaths();
	const navigate = useNavigate();
	const { business, joining, choice, setChoice, setResult } = useSignup();
	const catalog = useQuery({ queryKey: ['catalog', definition.productKey], queryFn: api.catalog });
	const debounced = useDebounced(choice);
	const totalLicences = totalSeats(choice.seats);
	const quote = useQuery({
		queryKey: ['quote', definition.productKey, debounced],
		queryFn: () => api.quote(debounced),
		enabled: !!catalog.data && totalLicences >= seatMinimum(definition, choice.planCode) && !!choice.planCode,
		retry: false,
		placeholderData: (previous) => previous,
	});
	const trial = useMutation({
		mutationFn: () => api.startTrial(business, joining),
		onSuccess: (result) => {
			setResult(result);
			navigate(paths.step('done'));
		},
	});

	useEffect(() => {
		document.title = 'Plan and users · ' + links.name;
	}, []);

	// Keep the choice valid for the catalog (a plan or add-on no longer sold is dropped).
	useEffect(() => {
		const data = catalog.data;
		if (!data) return;
		const plan = data.plans.find((p) => p.code === choice.planCode) ?? data.plans[0];
		if (!plan) return;
		const interval: Interval = pricesFor(plan, choice.interval) ? choice.interval : plan.yearly ? 'Year' : 'Month';
		const addOns = Object.fromEntries(Object.entries(choice.addOns).filter(([code]) => data.addOns.some((a) => a.code === code)));
		if (plan.code !== choice.planCode || interval !== choice.interval || Object.keys(addOns).length !== Object.keys(choice.addOns).length) {
			setChoice({ ...choice, planCode: plan.code, interval, addOns });
		}
	}, [catalog.data, choice, setChoice]);

	if (!isBusinessComplete(business)) return <Navigate to={paths.signup} replace />;

	return (
		<Page>
			<Steps current={2} />
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-headline font-semibold text-text-heading sm:text-display">{definition.seatModel === 'None' ? 'Choose your plan' : 'Choose your plan and users'}</h1>
					<p className="mt-1 text-body text-text-secondary">You can add users and modules later.</p>
				</div>
				<IntervalToggle value={choice.interval} freeMonths={catalog.data ? yearlyFreeMonths(catalog.data) : 0} onChange={(interval) => setChoice({ ...choice, interval })} />
			</div>

			{catalog.isPending ? (
				<p className="mt-10 text-text-muted">Loading plans…</p>
			) : catalog.isError ? (
				<div className="mt-8">
					<Alert>{catalog.error.message}</Alert>
				</div>
			) : (
				<div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
					<Choices catalog={catalog.data} choice={choice} onChange={setChoice} />
					<aside className="lg:sticky lg:top-6 lg:self-start">
						<Summary
							catalog={catalog.data}
							choice={choice}
							quote={quote.data}
							loading={quote.isFetching || choice !== debounced}
							error={
								totalLicences < seatMinimum(definition, choice.planCode)
									? `At least ${seatMinimum(definition, choice.planCode)} seats are needed.`
									: quote.isError
										? quote.error.message
										: null
							}
							onUpgrade={(planCode) => setChoice({ ...choice, planCode })}
							onContinue={() => navigate(paths.step('review'))}
							onTrial={() => trial.mutate()}
							trialBusy={trial.isPending}
							trialError={trial.error?.message ?? null}
						/>
					</aside>
				</div>
			)}

			<Button variant="ghost" className="mt-8" onClick={() => navigate(paths.signup)}>
				<ArrowLeft className="size-4" aria-hidden /> Back to your business
			</Button>
		</Page>
	);
}

function IntervalToggle({ value, freeMonths, onChange }: { value: Interval; freeMonths: number; onChange: (v: Interval) => void }) {
	return (
		<div role="radiogroup" aria-label="Billing" className="inline-flex rounded-md border border-border-subtle bg-surface-card p-1">
			{(['Month', 'Year'] as const).map((i) => (
				<button
					key={i}
					type="button"
					role="radio"
					aria-checked={value === i}
					onClick={() => onChange(i)}
					className={`h-9 rounded px-4 text-label font-semibold ${value === i ? 'bg-surface-raised text-text-heading' : 'text-text-secondary hover:text-text-heading'}`}
				>
					{i === 'Month' ? 'Monthly' : 'Yearly'}
					{i === 'Year' && freeMonths > 0 && <span className="ml-2 rounded-full bg-active-bg px-2 py-0.5 text-micro text-active">{freeMonthsLabel(freeMonths)}</span>}
				</button>
			))}
		</div>
	);
}

function Choices({ catalog, choice, onChange }: { catalog: PublicCatalog; choice: PlanChoice; onChange: (c: PlanChoice) => void }) {
	const plans = catalog.plans.filter((p) => pricesFor(p, choice.interval));
	const plan = plans.find((p) => p.code === choice.planCode);
	const prices = plan ? pricesFor(plan, choice.interval) : null;
	const total = totalSeats(choice.seats);
	const minimum = seatMinimum(catalog, choice.planCode);
	const addOnPrice = (code: string) => {
		const a = catalog.addOns.find((x) => x.code === code);
		return a ? (choice.interval === 'Year' ? a.yearlyPriceMinor : a.monthlyPriceMinor) : null;
	};

	return (
		<div className="flex flex-col gap-8">
			<section>
				<h2 className="mb-3 text-title font-semibold text-text-heading">Plan</h2>
				<div role="radiogroup" aria-label="Plan" className="grid gap-4 sm:grid-cols-2">
					{plans.map((p) => {
						const from = cheapestLicence(pricesFor(p, choice.interval));
						const selected = p.code === choice.planCode;
						return (
							<button
								key={p.code}
								type="button"
								role="radio"
								aria-checked={selected}
								onClick={() => onChange({ ...choice, planCode: p.code })}
								className={`rounded-lg border p-5 text-left transition ${selected ? 'border-action bg-action/10 ring-1 ring-action' : 'border-border-subtle bg-surface-card hover:border-text-muted'}`}
							>
								<div className="flex items-start justify-between gap-2">
									<span className="text-title font-semibold text-text-heading">{p.name}</span>
									<span className={`flex size-5 items-center justify-center rounded-full border ${selected ? 'border-action bg-action text-white' : 'border-border-subtle'}`}>
										{selected && <Check className="size-3" aria-hidden />}
									</span>
								</div>

								{from !== null && (
									<div className="tabular mt-3 text-body text-text-heading">
										from <strong>{moneyShort(from)}</strong>
										<span className="text-label text-text-muted"> / user{per(choice.interval)}</span>
									</div>
								)}
								<div className="mt-2 text-label text-text-muted">{p.modules.map((m) => featureName(catalog, m)).join(' · ') || p.name}</div>
							</button>
						);
					})}
				</div>
			</section>

			{catalog.seatModel === 'None' ? (
				<p className="text-body text-text-secondary">No per-user charges</p>
			) : (
				<section>
					<h2 className="text-title font-semibold text-text-heading">Seats</h2>
					<p className="mt-1 text-body text-text-secondary">Each person needs one seat. At least {minimum}.</p>
					<ul className="mt-4 flex flex-col gap-3">
						{catalog.seatTypes.map((t) => (
							<li key={t.code} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-card p-4">
								<div>
									<div className="text-body font-semibold text-text-heading">{t.name}</div>
									<div className="tabular text-label text-text-muted">
										{moneyShort(prices?.seats.find((s) => s.code === t.code)?.priceMinor ?? 0)} / user{per(choice.interval)}
									</div>
								</div>
								<Quantity label={`${t.name} licences`} value={choice.seats[t.code] ?? 0} onChange={(n) => onChange({ ...choice, seats: { ...choice.seats, [t.code]: n } })} />
							</li>
						))}
					</ul>
					<p className="mt-3 text-label text-text-secondary">
						{total} user{total === 1 ? '' : 's'} in total. You decide later who uses each seat.
					</p>
				</section>
			)}

			{catalog.addOns.length > 0 && (
				<section>
					<h2 className="mb-3 text-title font-semibold text-text-heading">Add-ons</h2>
					<ul className="flex flex-col gap-3">
						{catalog.addOns.map((a) => {
							const included = plan?.modules.includes(a.featureKey) && !a.isPack;
							const price = addOnPrice(a.code);
							const qty = choice.addOns[a.code] ?? 0;
							const setQty = (n: number) => {
								const next = { ...choice.addOns };
								if (n <= 0) delete next[a.code];
								else next[a.code] = n;
								onChange({ ...choice, addOns: next });
							};
							return (
								<li
									key={a.code}
									className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle p-4 ${included ? 'bg-surface-alt' : 'bg-surface-card'}`}
								>
									<label className={`flex min-w-0 flex-1 items-start gap-3 ${included || a.isPack ? '' : 'cursor-pointer'}`}>
										{included ? (
											<Check className="mt-0.5 size-5 shrink-0 text-active" aria-hidden />
										) : a.isPack ? null : (
											<input
												type="checkbox"
												checked={qty > 0}
												disabled={price === null}
												onChange={(e) => setQty(e.target.checked ? 1 : 0)}
												className="mt-0.5 size-5 shrink-0 accent-[#3b82f6]"
											/>
										)}
										<span className="min-w-0">
											<span className="block text-body font-semibold text-text-heading">{a.name || featureName(catalog, a.featureKey)}</span>
											<span className="block text-label text-text-secondary">{featureName(catalog, a.featureKey)}</span>
										</span>
									</label>
									{included ? (
										<span className="rounded-full bg-active-bg px-2.5 py-0.5 text-micro font-semibold text-active">Included in {plan?.name}</span>
									) : (
										<div className="flex items-center gap-3">
											<span className="tabular text-body font-semibold text-text-heading">
												{price !== null ? moneyShort(price) : '—'}
												<span className="text-label font-normal text-text-muted">
													{per(choice.interval)}
													{a.isPack ? ' each' : ''}
												</span>
											</span>
											{a.isPack && <Quantity label={a.name} value={qty} max={50} onChange={setQty} />}
										</div>
									)}
								</li>
							);
						})}
					</ul>
				</section>
			)}
		</div>
	);
}

function Summary(props: {
	catalog: PublicCatalog;
	choice: PlanChoice;
	quote: Quote | undefined;
	loading: boolean;
	error: string | null;
	onUpgrade: (planCode: string) => void;
	onContinue: () => void;
	onTrial: () => void;
	trialBusy: boolean;
	trialError: string | null;
}) {
	const { catalog, choice, quote, loading, error } = props;
	const plan = catalog.plans.find((p) => p.code === choice.planCode);
	const showQuote = quote && !error;
	return (
		<Card className="p-5 sm:p-6">
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-title font-semibold text-text-heading">Your order</h2>
				<span className="rounded-full bg-active-bg px-2.5 py-0.5 text-micro font-semibold text-active">
					{plan?.name ?? '—'} · {choice.interval === 'Year' ? 'Yearly' : 'Monthly'}
				</span>
			</div>
			<div aria-live="polite" className={`mt-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
				{error ? (
					<Alert>{error}</Alert>
				) : showQuote ? (
					<>
						<ul className="flex flex-col gap-3">
							{quote.lines.map((line) => (
								<li key={line.description} className="flex items-start justify-between gap-3 text-body">
									<span className="min-w-0">
										<span className="block text-text-heading">{line.description.split(',')[0]?.replace(/ \((monthly|yearly)\)$/, '')}</span>
										{line.quantity > 1 && (
											<span className="tabular block text-label text-text-muted">
												{line.quantity} × {moneyShort(line.unitPriceMinor)}
											</span>
										)}
									</span>
									<span className="tabular shrink-0 text-text-primary">{money(line.amountMinor, quote.currency)}</span>
								</li>
							))}
						</ul>
						<div className="mt-4 flex items-end justify-between gap-3 border-t border-border-subtle pt-4">
							<span className="text-body text-text-secondary">Total {choice.interval === 'Year' ? 'per year' : 'per month'}</span>
							<span className="tabular text-headline font-bold text-text-heading">{money(quote.totalMinor, quote.currency)}</span>
						</div>
						<p className="mt-1 text-right text-label text-active">{quote.taxMinor > 0 ? `Includes GST ${money(quote.taxMinor)}` : 'No GST charged'}</p>
						{quote.cheaper && (
							<div className="mt-4 rounded-md border border-active/30 bg-active-bg p-3 text-label text-text-primary">
								<div className="flex items-start gap-2">
									<Lightbulb className="mt-0.5 size-4 shrink-0 text-active" aria-hidden />
									<span>
										<strong>Tip:</strong> {quote.cheaper.planName} includes these modules and costs <strong className="tabular">{money(quote.cheaper.totalMinor)}</strong> with the
										same users.
									</span>
								</div>
								<button type="button" onClick={() => props.onUpgrade(quote.cheaper!.planCode)} className="mt-2 font-semibold text-active hover:underline">
									Switch to {quote.cheaper.planName}
								</button>
							</div>
						)}
					</>
				) : (
					<p className="text-body text-text-muted">Working out your price…</p>
				)}
			</div>
			<div className="mt-5 flex flex-col gap-3">
				<Button variant="primary" disabled={!showQuote || loading} onClick={props.onContinue} icon={<ArrowRight className="size-4" />}>
					Continue to payment
				</Button>
				<Button onClick={props.onTrial} loading={props.trialBusy}>
					Start {catalog.trialDays}-day free trial instead
				</Button>
				<p className="text-center text-label text-text-muted">
					Full {catalog.plans.find((p) => p.code === catalog.trialPlanCode)?.name ?? catalog.productName} for {catalog.trialDays} days{' '}
					{catalog.seatModel === 'None' ? 'with no per-user charges.' : `with ${catalog.trialLicences} users.`} No payment now.
				</p>
				{props.trialError && <Alert>{props.trialError}</Alert>}
			</div>
		</Card>
	);
}
