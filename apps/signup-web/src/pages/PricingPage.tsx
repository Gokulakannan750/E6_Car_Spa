import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, ChevronDown, Minus, Monitor, Smartphone, Laptop } from 'lucide-react';
import { Page } from '@/components/Frame';
import { Alert, Button, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { CORE_FEATURES, FEATURES, MODULE_ORDER, PLAN_TAGLINES, featureName } from '@/lib/featureNames';
import { moneyShort } from '@/lib/format';
import { LICENCE_TYPES, per, pricesFor } from '@/lib/rules';
import type { Interval, PublicCatalog } from '@/lib/types';
import { DEFAULT_CHOICE, useSignup } from '@/state/signup';

const LICENCE_ICONS = { both: Laptop, windows: Monitor, android: Smartphone } as const;

export function PricingPage() {
	const navigate = useNavigate();
	const { choice, setChoice } = useSignup();
	const [interval, setInterval] = useState<Interval>(choice.interval);
	const catalog = useQuery({ queryKey: ['catalog'], queryFn: api.catalog });

	useEffect(() => {
		document.title = 'Plans and prices · Baylior';
	}, []);

	function choose(planCode: string) {
		setChoice({ ...DEFAULT_CHOICE, ...choice, planCode, interval });
		navigate('/signup');
	}

	return (
		<Page>
			<section className="mx-auto max-w-[760px] text-center">
				<h1 className="text-[40px] leading-[48px] font-bold tracking-tight text-text-heading sm:text-[48px] sm:leading-[56px]">Run your car spa on Baylior</h1>
				<p className="mt-3 text-title font-semibold">
					One suite. <span className="text-brand-gradient">Every detail.</span>
				</p>
				<p className="mt-4 text-[17px] leading-7 text-text-secondary">
					Billing, job cards, invoices, staff and WhatsApp in one place — on Windows and Android.
					{catalog.data ? ` Start with a ${catalog.data.trialDays}-day free trial.` : ''}
				</p>
				<div className="mt-7 flex flex-wrap justify-center gap-3">
					<Button variant="primary" onClick={() => choose(choice.planCode || 'professional')} icon={<ArrowRight className="size-4" />}>
						Start free trial
					</Button>
					<Button onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}>See plans</Button>
				</div>
			</section>

			<section id="plans" className="mt-14 scroll-mt-6">
				<div className="flex flex-col items-center gap-3">
					<div role="radiogroup" aria-label="Billing" className="inline-flex rounded-full border border-border-subtle bg-surface-card p-1">
						{(['Month', 'Year'] as const).map((i) => (
							<button
								key={i}
								type="button"
								role="radio"
								aria-checked={interval === i}
								onClick={() => setInterval(i)}
								className={`h-9 rounded-full px-5 text-label font-semibold ${interval === i ? 'bg-action text-white' : 'text-text-secondary hover:text-text-heading'}`}
							>
								{i === 'Month' ? 'Monthly' : 'Yearly'}
								{i === 'Year' && <span className="ml-2 rounded-full bg-active-bg px-2 py-0.5 text-micro text-active">2 months free</span>}
							</button>
						))}
					</div>
					<p className="max-w-[560px] text-center text-body text-text-secondary">
						You pay per user. Each user needs a licence for the Android app, the Windows app, or both.
					</p>
				</div>

				{catalog.isPending ? (
					<p className="mt-10 text-center text-text-muted">Loading prices…</p>
				) : catalog.isError ? (
					<div className="mx-auto mt-10 max-w-[560px]">
						<Alert>{catalog.error.message}</Alert>
					</div>
				) : (
					<Plans catalog={catalog.data} interval={interval} onChoose={choose} />
				)}
			</section>

			{catalog.data && (
				<>
					<AddOns catalog={catalog.data} interval={interval} />
					<Comparison catalog={catalog.data} />
					<Faq catalog={catalog.data} />
					<Card className="mt-14 p-8 text-center">
						<h2 className="text-headline font-semibold text-text-heading">Ready to start?</h2>
						<p className="mt-2 text-body text-text-secondary">Sign up in about 3 minutes. No payment for the {catalog.data.trialDays}-day free trial.</p>
						<Button variant="primary" className="mt-5" onClick={() => choose(choice.planCode || 'professional')} icon={<ArrowRight className="size-4" />}>
							Start {catalog.data.trialDays}-day free trial
						</Button>
					</Card>
				</>
			)}
		</Page>
	);
}

function Plans({ catalog, interval, onChoose }: { catalog: PublicCatalog; interval: Interval; onChoose: (code: string) => void }) {
	const plans = catalog.plans.filter((p) => pricesFor(p, interval));
	const featured = plans.find((p) => p.code === 'professional')?.code;
	const base = plans[0];
	return (
		<div className={`mt-8 grid gap-6 ${plans.length > 1 ? 'md:grid-cols-2' : ''}`}>
			{plans.map((plan) => {
				const prices = pricesFor(plan, interval)!;
				const isFeatured = plan.code === featured;
				const order = (m: string) => (MODULE_ORDER.indexOf(m) + 1 || 99);
				const extra = (base && plan.code !== base.code ? plan.modules.filter((m) => !base.modules.includes(m)) : plan.modules).sort((a, b) => order(a) - order(b));
				return (
					<Card key={plan.code} className={`relative flex flex-col p-6 ${isFeatured ? 'border-action/60 shadow-[0_0_40px_rgba(59,130,246,0.15)]' : ''}`}>
						{isFeatured && (
							<span className="absolute -top-3 right-6 rounded-full bg-brand px-3 py-1 text-micro font-semibold tracking-wider text-white uppercase">Most popular</span>
						)}
						<h3 className="text-headline font-semibold text-text-heading">{plan.name}</h3>
						{PLAN_TAGLINES[plan.code] && <p className="mt-1 text-body text-text-secondary">{PLAN_TAGLINES[plan.code]}</p>}
						<table className="mt-5 w-full rounded-md bg-surface-alt text-body">
							<tbody className="tabular">
								{LICENCE_TYPES.map((t) => {
									const Icon = LICENCE_ICONS[t.key];
									return (
										<tr key={t.key} className="border-b border-border-hairline last:border-0">
											<td className="flex items-center gap-2 px-4 py-2.5 text-text-primary">
												<Icon className="size-4 text-text-muted" aria-hidden /> {t.label}
											</td>
											<td className="px-4 py-2.5 text-right">
												<span className="font-semibold text-text-heading">{moneyShort(t.price(prices))}</span>
												<span className="text-label text-text-muted"> / user{per(interval)}</span>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						{prices.companyFeeMinor > 0 && (
							<p className="mt-2 text-label text-text-muted">
								Plus {moneyShort(prices.companyFeeMinor)}
								{per(interval)} per company.
							</p>
						)}
						<div className="mt-5 text-micro font-semibold tracking-wider text-text-muted uppercase">
							{base && plan.code !== base.code ? `Everything in ${base.name}, plus` : 'Includes'}
						</div>
						<ul className="mt-2 flex flex-1 flex-col gap-2 text-body text-text-primary">
							{(base && plan.code !== base.code ? extra.map(featureName) : CORE_FEATURES).map((f) => (
								<li key={f} className="flex items-start gap-2">
									<Check className="mt-0.5 size-4 shrink-0 text-active" aria-hidden /> {f}
								</li>
							))}
						</ul>
						<Button variant={isFeatured ? 'primary' : 'secondary'} className="mt-6 w-full" onClick={() => onChoose(plan.code)}>
							Choose {plan.name}
						</Button>
					</Card>
				);
			})}
		</div>
	);
}

function AddOns({ catalog, interval }: { catalog: PublicCatalog; interval: Interval }) {
	const modules = catalog.addOns.filter((a) => MODULE_ORDER.includes(a.featureKey));
	const others = catalog.addOns.filter((a) => !MODULE_ORDER.includes(a.featureKey));
	const price = (a: (typeof catalog.addOns)[number]) => (interval === 'Year' ? a.yearlyPriceMinor : a.monthlyPriceMinor);
	const starter = catalog.plans.find((p) => p.code === 'starter');
	const modulePrices = modules.map(price).filter((p): p is number => p !== null);
	return (
		<section className="mt-16">
			<h2 className="text-headline font-semibold text-text-heading">Add-ons</h2>
			<p className="mt-1 text-body text-text-secondary">Add what your business needs, when it needs it.</p>
			<div className="mt-5 grid gap-4 md:grid-cols-3">
				{others.map((a) => (
					<Card key={a.code} className="p-5">
						<div className="flex items-start justify-between gap-3">
							<h3 className="text-title font-semibold text-text-heading">{a.name}</h3>
							<span className="tabular shrink-0 text-body font-semibold text-text-heading">
								{price(a) !== null ? moneyShort(price(a)!) : '—'}
								<span className="text-label font-normal text-text-muted">{per(interval)}</span>
							</span>
						</div>
						<p className="mt-2 text-label text-text-secondary">{FEATURES[a.featureKey]?.description}</p>
					</Card>
				))}
			</div>
			{starter && modules.length > 0 && (
				<Card className="mt-4 p-5">
					<p className="text-body text-text-primary">
						On <strong className="text-text-heading">{starter.name}</strong> you can also add any {catalog.plans.find((p) => p.code === 'professional')?.name ?? 'Professional'} module
						{modulePrices.length ? (
							<>
								{' '}
								for <strong className="tabular text-text-heading">{moneyShort(Math.min(...modulePrices))}</strong>
								{per(interval)} each
							</>
						) : null}
						:
					</p>
					<div className="mt-3 flex flex-wrap gap-2">
						{modules.map((m) => (
							<span key={m.code} className="rounded-full border border-border-subtle bg-surface-alt px-3 py-1 text-label text-text-secondary">
								{m.name}
							</span>
						))}
					</div>
				</Card>
			)}
		</section>
	);
}

function Comparison({ catalog }: { catalog: PublicCatalog }) {
	const plans = catalog.plans;
	if (plans.length < 2) return null;
	const rows: { label: string; inPlan: (modules: string[]) => boolean | 'addon' }[] = [
		...CORE_FEATURES.map((label) => ({ label, inPlan: () => true as const })),
		...MODULE_ORDER.map((key) => ({
			label: featureName(key),
			inPlan: (modules: string[]) => (modules.includes(key) ? true : catalog.addOns.some((a) => a.featureKey === key) ? ('addon' as const) : false),
		})),
		{ label: 'Windows app', inPlan: () => true as const },
		{ label: 'Android app', inPlan: () => true as const },
	];
	return (
		<section className="mt-16">
			<h2 className="text-headline font-semibold text-text-heading">Compare plans</h2>
			<Card className="mt-5 overflow-x-auto">
				<table className="w-full min-w-[520px] text-body">
					<thead>
						<tr className="border-b border-border-subtle text-left text-label font-semibold tracking-wider text-text-muted uppercase">
							<th className="px-5 py-3">Feature</th>
							{plans.map((p) => (
								<th key={p.code} className="px-5 py-3 text-center">
									{p.name}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.label} className="border-b border-border-hairline last:border-0">
								<td className="px-5 py-3 text-text-primary">{row.label}</td>
								{plans.map((p) => {
									const v = row.inPlan(p.modules);
									return (
										<td key={p.code} className="px-5 py-3 text-center">
											{v === true ? (
												<Check className="mx-auto size-4 text-active" aria-label="Included" />
											) : v === 'addon' ? (
												<span className="text-label text-text-secondary">Add-on</span>
											) : (
												<Minus className="mx-auto size-4 text-text-muted" aria-label="Not included" />
											)}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</Card>
		</section>
	);
}

function Faq({ catalog }: { catalog: PublicCatalog }) {
	const items = [
		{
			q: 'What is a user licence?',
			a: 'Each person who uses the software needs one. A Windows + Android licence lets one person use both apps; Windows-only and Android-only licences cost less.',
		},
		{
			q: 'What happens after the free trial?',
			a: `Choose a plan and pay. If you don't, you get ${catalog.graceDays} more days to pay, then the software becomes read-only until you do. Your data is never deleted.`,
		},
		{ q: 'Can I add users later?', a: 'Yes. Call Trovo and we add licences or modules to your subscription.' },
		{
			q: 'Is GST charged?',
			a: catalog.chargesGst ? `Yes, GST at ${catalog.gstRatePercent}% is added to the price.` : 'No GST is charged at present.',
		},
	];
	return (
		<section className="mx-auto mt-16 max-w-[760px]">
			<h2 className="text-center text-headline font-semibold text-text-heading">Questions</h2>
			<div className="mt-5 flex flex-col gap-3">
				{items.map((item) => (
					<details key={item.q} className="group rounded-lg border border-border-subtle bg-surface-card">
						<summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-body font-medium text-text-heading">
							{item.q}
							<ChevronDown className="size-4 shrink-0 text-text-muted transition group-open:rotate-180" aria-hidden />
						</summary>
						<p className="px-5 pb-4 text-body text-text-secondary">{item.a}</p>
					</details>
				))}
			</div>
		</section>
	);
}
