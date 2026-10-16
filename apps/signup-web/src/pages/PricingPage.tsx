import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Minus } from 'lucide-react';
import { Page } from '@/components/Frame';
import { Button, Card } from '@/components/ui';
import { featureName } from '@/lib/featureNames';
import { moneyShort } from '@/lib/format';
import { freeMonthsLabel, per, pricesFor, yearlyFreeMonths } from '@/lib/rules';
import type { Interval } from '@/lib/types';
import { useSignup } from '@/state/signup';
import { useProduct, usePaths } from '@/state/product';
export function PricingPage() {
	const { catalog, brand } = useProduct();
	const paths = usePaths();
	const { choice, setChoice } = useSignup();
	const navigate = useNavigate();
	const [interval, setInterval] = useState<Interval>(choice.interval);
	const freeMonths = yearlyFreeMonths(catalog);
	useEffect(() => {
		document.title = `Plans and prices · ${brand.name}`;
	}, [brand.name]);
	function choose(planCode: string) {
		setChoice({ ...choice, planCode, interval });
		navigate(paths.signup);
	}
	const features = [...new Set(catalog.plans.flatMap((p) => p.modules))];
	return (
		<Page>
			<section className="mx-auto max-w-[760px] text-center">
				<h1 className="text-[40px] leading-[48px] font-bold tracking-tight text-text-heading sm:text-[48px] sm:leading-[56px]">{brand.headline}</h1>
				<p className="mt-4 text-title text-text-secondary">
					{brand.intro} Start with a {catalog.trialDays}-day free trial.
				</p>
				<div className="mt-7 flex flex-wrap justify-center gap-3">
					<Button variant="primary" onClick={() => choose(choice.planCode)} icon={<ArrowRight className="size-4" />}>
						Start free trial
					</Button>
					<Button onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}>See plans</Button>
				</div>
			</section>
			<section id="plans" className="mt-14 scroll-mt-6">
				<div role="radiogroup" aria-label="Billing" className="mx-auto flex w-fit rounded-full border border-border-subtle bg-surface-card p-1">
					{(['Month', 'Year'] as const).map((i) => (
						<button
							key={i}
							type="button"
							role="radio"
							aria-checked={interval === i}
							onClick={() => setInterval(i)}
							className={`h-10 rounded-full px-5 text-label ${interval === i ? 'bg-action text-white' : 'text-text-secondary'}`}
						>
							{i === 'Year' ? 'Yearly' : 'Monthly'}
							{i === 'Year' && freeMonths > 0 && <span className="ml-2 text-active">{freeMonthsLabel(freeMonths)}</span>}
						</button>
					))}
				</div>
				<p className="mt-4 text-center text-body text-text-secondary">
					{catalog.seatModel === 'None' ? 'No per-user charges' : 'Choose seats for the people who use your software.'}
				</p>
				<div className="mt-8 grid gap-6 md:grid-cols-2">
					{catalog.plans
						.filter((p) => pricesFor(p, interval))
						.map((p) => {
							const prices = pricesFor(p, interval)!;
							return (
								<Card key={p.code} className="flex flex-col p-6">
									<h2 className="text-headline text-text-heading">{p.name}</h2>
									{catalog.seatModel === 'None' ? (
										<p className="mt-5 text-title text-text-heading">
											{moneyShort(prices.companyFeeMinor)}
											{per(interval)}
										</p>
									) : (
										<table className="mt-5 w-full text-body">
											<tbody>
												{catalog.seatTypes.map((t) => (
													<tr key={t.code}>
														<td className="py-2 text-text-primary">{t.name}</td>
														<td className="py-2 text-right text-text-heading">
															<strong>{moneyShort(prices.seats.find((s) => s.code === t.code)?.priceMinor ?? 0)}</strong>
															<span className="text-label text-text-muted"> / user{per(interval)}</span>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									)}
									{catalog.seatModel !== 'None' && prices.companyFeeMinor > 0 && (
										<p>
											Plus {moneyShort(prices.companyFeeMinor)}
											{per(interval)} per company.
										</p>
									)}
									<ul className="mt-5 flex flex-1 flex-col gap-2 text-body text-text-primary">
										{p.modules.map((key) => (
											<li key={key} className="flex gap-2">
												<Check className="size-4 shrink-0 text-active" aria-hidden />
												{featureName(catalog, key)}
											</li>
										))}
									</ul>
									<Button className="mt-6 w-full" variant="primary" onClick={() => choose(p.code)}>
										Choose {p.name}
									</Button>
								</Card>
							);
						})}
				</div>
			</section>
			{catalog.addOns.length > 0 && (
				<section className="mt-14">
					<h2 className="text-headline text-text-heading">Add-ons</h2>
					<div className="mt-5 grid gap-4 md:grid-cols-3">
						{catalog.addOns.map((a) => (
							<Card key={a.code} className="p-5">
								<h3 className="text-title text-text-heading">{a.name || featureName(catalog, a.featureKey)}</h3>
								<p className="text-body text-text-secondary">{featureName(catalog, a.featureKey)}</p>
								<p className="mt-2 text-text-heading">
									{moneyShort((interval === 'Year' ? a.yearlyPriceMinor : a.monthlyPriceMinor) ?? 0)}
									{per(interval)}
								</p>
							</Card>
						))}
					</div>
				</section>
			)}
			{catalog.plans.length > 1 && (
				<section className="mt-14">
					<h2 className="text-headline text-text-heading">Compare plans</h2>
					<Card className="mt-5 overflow-x-auto">
						<table className="w-full min-w-[520px] text-body">
							<thead>
								<tr>
									<th className="p-4 text-left">Feature</th>
									{catalog.plans.map((p) => (
										<th key={p.code} className="p-4">
											{p.name}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{features.map((key) => (
									<tr key={key}>
										<td className="p-4 text-text-primary">{featureName(catalog, key)}</td>
										{catalog.plans.map((p) => (
											<td key={p.code} className="p-4 text-center">
												{p.modules.includes(key) ? (
													<Check className="mx-auto size-4 text-active" aria-label="Included" />
												) : catalog.addOns.some((a) => a.featureKey === key) ? (
													'Add-on'
												) : (
													<Minus className="mx-auto size-4" aria-label="Not included" />
												)}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</Card>
				</section>
			)}
			<section className="mx-auto mt-14 max-w-[760px]">
				<h2 className="text-headline text-text-heading">Questions</h2>
				{[
					['What happens after the free trial?', `Choose a plan and pay. You have ${catalog.graceDays} grace days before the software becomes read-only.`],
					['Can I change my plan later?', 'Yes. Contact Trovo or use Subscription in your product to review changes.'],
					['Is GST charged?', catalog.chargesGst ? `GST at ${catalog.gstRatePercent}% is added to the price.` : 'No GST is charged at present.'],
				].map(([q, a]) => (
					<details key={q} className="mt-3 rounded-lg border border-border-subtle p-4">
						<summary className="cursor-pointer text-text-heading">{q}</summary>
						<p className="mt-2 text-body text-text-secondary">{a}</p>
					</details>
				))}
			</section>
		</Page>
	);
}
