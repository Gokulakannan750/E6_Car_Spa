import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleSlash, History, Tag } from 'lucide-react';
import { useBreadcrumbs } from '@/app/layout/Breadcrumbs';
import { Button } from '@/components/Button';
import { SelectField, TextareaField, TextField } from '@/components/Field';
import { Modal } from '@/components/Modal';
import { Card, CardHeader, ErrorState, InlineError, LoadingState, PageHeader } from '@/components/Surface';
import { useToast } from '@/components/Toast';
import { useAuth, BILLING_ROLES } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { BOOLEAN_FEATURES, featureLabel } from '@/lib/catalog';
import { date, intervalLabel, moneyShort, parseRupees, perInterval } from '@/lib/format';
import type { AddOn, Plan, PlanVersion } from '@/lib/types';
import { currentAddOnPrice, currentVersion } from './PlanPicker';

export function PlansPage() {
	useBreadcrumbs({ label: 'Plans & Prices' });
	const { can } = useAuth();
	const catalog = useQuery({ queryKey: ['plans'], queryFn: api.plans });
	const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
	const [editingAddOn, setEditingAddOn] = useState<AddOn | null>(null);
	const billingRole = can(...BILLING_ROLES);

	return (
		<>
			<PageHeader
				title="Plans & Prices"
				description="A new price applies to new subscriptions and to existing ones from their next renewal. Old prices stay in the history."
			/>
			{catalog.isPending ? (
				<LoadingState />
			) : catalog.isError ? (
				<ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />
			) : (
				<>
					<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
						{catalog.data.plans.map((plan) => (
							<PlanCard key={plan.id} plan={plan} onNewPrice={billingRole ? () => setEditingPlan(plan) : undefined} />
						))}
					</div>

					<Card className="mt-6">
						<CardHeader title="Add-ons" subtitle="Bought on top of a plan. Packs (more users, more branches) can be bought several times." />
						<div className="overflow-x-auto">
							<table className="w-full text-table">
								<thead>
									<tr className="border-b border-border-subtle text-left text-label font-semibold tracking-[0.04em] text-text-muted uppercase">
										<th className="h-10 px-5">Add-on</th>
										<th className="h-10 px-4">Gives</th>
										<th className="h-10 px-4 text-right">Monthly</th>
										<th className="h-10 px-4 text-right">Yearly</th>
										<th className="h-10 px-4">Since</th>
										<th className="h-10 px-5 text-right">
											<span className="sr-only">Actions</span>
										</th>
									</tr>
								</thead>
								<tbody>
									{catalog.data.addOns.map((addOn) => {
										const month = currentAddOnPrice(addOn.prices, 'Month');
										const year = currentAddOnPrice(addOn.prices, 'Year');
										return (
											<tr key={addOn.id} className="h-11 border-b border-border-hairline last:border-b-0">
												<td className="px-5 py-2">
													<div className="font-medium text-text-heading">{addOn.name}</div>
													<div className="font-mono text-micro text-text-muted">{addOn.code}</div>
												</td>
												<td className="px-4 py-2 text-text-secondary">
													{featureLabel(addOn.featureKey)}
													{addOn.value !== 'true' && <span className="ml-1">+{addOn.value}</span>}
												</td>
												<td className="tabular px-4 py-2 text-right">{month ? moneyShort(month.unitPriceMinor, month.currency) : '—'}</td>
												<td className="tabular px-4 py-2 text-right">{year ? moneyShort(year.unitPriceMinor, year.currency) : '—'}</td>
												<td className="tabular px-4 py-2 text-text-secondary">{date(month?.effectiveFrom ?? year?.effectiveFrom)}</td>
												<td className="px-5 py-2 text-right">
													{billingRole && (
														<Button size="sm" onClick={() => setEditingAddOn(addOn)}>
															New price
														</Button>
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</Card>
					<p className="mt-4 text-label text-text-muted">
						{catalog.data.chargesGst ? `GST at ${catalog.data.gstRatePercent}% is added to invoices.` : 'Trovo does not charge GST yet; invoices show the price only.'}
					</p>
				</>
			)}
			<PlanPriceDialog plan={editingPlan} onClose={() => setEditingPlan(null)} />
			<AddOnPriceDialog addOn={editingAddOn} onClose={() => setEditingAddOn(null)} />
		</>
	);
}

function PlanCard({ plan, onNewPrice }: { plan: Plan; onNewPrice?: () => void }) {
	const [showHistory, setShowHistory] = useState(false);
	const month = currentVersion(plan.versions, 'Month');
	const year = currentVersion(plan.versions, 'Year');
	const reference = month ?? year;
	const yearlySaving = month && year ? month.priceMinor * 12 - year.priceMinor : 0;
	const history = [...plan.versions].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

	return (
		<Card>
			<CardHeader
				title={
					<span className="flex items-center gap-2">
						<Tag className="size-4 text-action" /> {plan.name}
						{!plan.isActive && <span className="text-label text-text-muted">(not offered)</span>}
					</span>
				}
				subtitle={<span className="font-mono">{plan.code}</span>}
				actions={
					onNewPrice && (
						<Button size="sm" onClick={onNewPrice}>
							New price
						</Button>
					)
				}
			/>
			<div className="p-5">
				<div className="grid grid-cols-2 gap-4">
					<PriceBox label="Monthly" version={month} />
					<PriceBox label="Yearly" version={year} note={yearlySaving > 0 ? `Saves ${moneyShort(yearlySaving)} a year` : undefined} />
				</div>
				{reference && (
					<>
						<div className="mt-5 mb-2 text-micro font-medium tracking-wide text-text-muted uppercase">Includes</div>
						<ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
							<li className="flex items-center gap-2 text-body text-text-heading">
								<CheckCircle2 className="size-4 text-active" /> {reference.includedSeats} users
							</li>
							{BOOLEAN_FEATURES.filter((k) => reference.entitlements.some((e) => e.featureKey === k)).map((key) => {
								const on = reference.entitlements.find((e) => e.featureKey === key)?.value === 'true';
								return (
									<li key={key} className={`flex items-center gap-2 text-body ${on ? 'text-text-heading' : 'text-text-muted'}`}>
										{on ? <CheckCircle2 className="size-4 text-active" /> : <CircleSlash className="size-4" />}
										{featureLabel(key)}
									</li>
								);
							})}
						</ul>
					</>
				)}
				<button type="button" onClick={() => setShowHistory((s) => !s)} className="mt-5 inline-flex items-center gap-1.5 text-label text-action hover:text-action-hover">
					<History className="size-3.5" /> {showHistory ? 'Hide price history' : `Price history (${plan.versions.length})`}
				</button>
				{showHistory && (
					<table className="mt-2 w-full text-table">
						<thead>
							<tr className="border-b border-border-subtle text-left text-micro font-semibold tracking-[0.04em] text-text-muted uppercase">
								<th className="h-8 pr-3">Version</th>
								<th className="h-8 pr-3">Billing</th>
								<th className="h-8 pr-3 text-right">Price</th>
								<th className="h-8 pr-3 text-right">Users</th>
								<th className="h-8">In force</th>
							</tr>
						</thead>
						<tbody className="tabular">
							{history.map((v) => (
								<tr key={v.id} className={`h-8 border-b border-border-hairline last:border-b-0 ${v.effectiveTo ? 'text-text-muted' : 'text-text-primary'}`}>
									<td className="pr-3">v{v.version}</td>
									<td className="pr-3">{intervalLabel(v.interval)}</td>
									<td className="pr-3 text-right">{moneyShort(v.priceMinor, v.currency)}</td>
									<td className="pr-3 text-right">{v.includedSeats}</td>
									<td>
										{date(v.effectiveFrom)} – {v.effectiveTo ? date(v.effectiveTo) : 'now'}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</Card>
	);
}

function PriceBox({ label, version, note }: { label: string; version?: PlanVersion; note?: string }) {
	return (
		<div className="rounded-lg border border-border-subtle bg-surface-alt p-4">
			<div className="text-micro font-medium tracking-wide text-text-muted uppercase">{label}</div>
			{version ? (
				<>
					<div className="tabular mt-1 text-headline font-bold text-text-heading">
						{moneyShort(version.priceMinor, version.currency)}
						<span className="text-body font-normal text-text-muted">{perInterval(version.interval)}</span>
					</div>
					<div className="text-micro text-text-muted">
						v{version.version} · since {date(version.effectiveFrom)}
					</div>
					{note && <div className="mt-1 text-micro text-active">{note}</div>}
				</>
			) : (
				<div className="mt-1 text-body text-text-muted">Not offered</div>
			)}
		</div>
	);
}

function PlanPriceDialog({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
	const toast = useToast();
	const queryClient = useQueryClient();
	const [interval, setInterval] = useState<'Month' | 'Year'>('Month');
	const [price, setPrice] = useState('');
	const [seats, setSeats] = useState('');
	const [features, setFeatures] = useState<Record<string, boolean>>({});
	const [reason, setReason] = useState('');
	const [errors, setErrors] = useState<{ price?: string; seats?: string; reason?: string }>({});

	function load(p: Plan, i: 'Month' | 'Year') {
		const v = currentVersion(p.versions, i);
		setPrice(v ? (v.priceMinor / 100).toFixed(0) : '');
		setSeats(v ? String(v.includedSeats) : '');
		setFeatures(Object.fromEntries(BOOLEAN_FEATURES.map((k) => [k, v?.entitlements.find((e) => e.featureKey === k)?.value === 'true'])));
	}

	useEffect(() => {
		if (plan) {
			setInterval('Month');
			load(plan, 'Month');
			setReason('');
			setErrors({});
			mutation.reset();
		}
	}, [plan?.id]);

	const mutation = useMutation({
		mutationFn: (body: Parameters<typeof api.newPlanVersion>[1]) => api.newPlanVersion(plan!.code, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['plans'] });
			toast.success(`New ${interval === 'Month' ? 'monthly' : 'yearly'} price saved for ${plan!.name}.`);
			onClose();
		},
	});

	function submit(event: FormEvent) {
		event.preventDefault();
		const next: typeof errors = {};
		const minor = parseRupees(price);
		if (minor === null || minor <= 0) next.price = 'Enter the price in rupees, e.g. 1999.';
		if (!/^\d+$/.test(seats) || Number(seats) < 1 || Number(seats) > 1000) next.seats = 'A whole number from 1 to 1000.';
		if (!reason.trim()) next.reason = 'A reason is required.';
		setErrors(next);
		if (Object.keys(next).length > 0 || minor === null) return;
		const entitlements: Record<string, string> = Object.fromEntries(BOOLEAN_FEATURES.map((k) => [k, features[k] ? 'true' : 'false']));
		entitlements['users.max_active'] = seats;
		mutation.mutate({ interval, priceMinor: minor, includedSeats: Number(seats), entitlements, reason: reason.trim() });
	}

	return (
		<Modal
			open={plan !== null}
			onClose={onClose}
			title={`New price for ${plan?.name ?? ''}`}
			description="Creates a new version. Subscriptions move to it at their next renewal; nothing already invoiced changes."
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="plan-price" variant="primary" loading={mutation.isPending}>
						Save new price
					</Button>
				</>
			}
		>
			<form id="plan-price" onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<SelectField
					label="Billing"
					value={interval}
					onChange={(e) => {
						const i = e.target.value as 'Month' | 'Year';
						setInterval(i);
						if (plan) load(plan, i);
					}}
				>
					<option value="Month">Monthly</option>
					<option value="Year">Yearly</option>
				</SelectField>
				<TextField label="Price (₹)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} error={errors.price} className="tabular" />
				<TextField label="Users included" inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, ''))} error={errors.seats} />
				<fieldset className="sm:col-span-2">
					<legend className="mb-2 text-label font-medium text-text-primary">Features</legend>
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
						{BOOLEAN_FEATURES.map((key) => (
							<label key={key} className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-alt px-3 py-2 text-body text-text-primary">
								<input
									type="checkbox"
									checked={!!features[key]}
									onChange={(e) => setFeatures((f) => ({ ...f, [key]: e.target.checked }))}
									className="size-4 accent-[#3b82f6]"
								/>
								{featureLabel(key)}
							</label>
						))}
					</div>
				</fieldset>
				<TextareaField
					label="Reason (recorded in the audit log)"
					containerClassName="sm:col-span-2"
					maxLength={500}
					value={reason}
					onChange={(e) => setReason(e.target.value)}
					error={errors.reason}
					placeholder="e.g. Price revision for 2027"
				/>
				<div className="sm:col-span-2">
					<InlineError message={mutation.error?.message} />
				</div>
			</form>
		</Modal>
	);
}

function AddOnPriceDialog({ addOn, onClose }: { addOn: AddOn | null; onClose: () => void }) {
	const toast = useToast();
	const queryClient = useQueryClient();
	const [interval, setInterval] = useState<'Month' | 'Year'>('Month');
	const [price, setPrice] = useState('');
	const [reason, setReason] = useState('');
	const [errors, setErrors] = useState<{ price?: string; reason?: string }>({});

	function load(a: AddOn, i: 'Month' | 'Year') {
		const p = currentAddOnPrice(a.prices, i);
		setPrice(p ? (p.unitPriceMinor / 100).toFixed(0) : '');
	}

	useEffect(() => {
		if (addOn) {
			setInterval('Month');
			load(addOn, 'Month');
			setReason('');
			setErrors({});
			mutation.reset();
		}
	}, [addOn?.id]);

	const mutation = useMutation({
		mutationFn: (body: Parameters<typeof api.newAddOnPrice>[1]) => api.newAddOnPrice(addOn!.code, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['plans'] });
			toast.success(`New price saved for ${addOn!.name}.`);
			onClose();
		},
	});

	function submit(event: FormEvent) {
		event.preventDefault();
		const next: typeof errors = {};
		const minor = parseRupees(price);
		if (minor === null || minor <= 0) next.price = 'Enter the price in rupees, e.g. 999.';
		if (!reason.trim()) next.reason = 'A reason is required.';
		setErrors(next);
		if (Object.keys(next).length > 0 || minor === null) return;
		mutation.mutate({ interval, unitPriceMinor: minor, reason: reason.trim() });
	}

	return (
		<Modal
			open={addOn !== null}
			onClose={onClose}
			width="sm"
			title={`New price for ${addOn?.name ?? ''}`}
			description="Existing subscriptions move to it at their next renewal."
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="addon-price" variant="primary" loading={mutation.isPending}>
						Save new price
					</Button>
				</>
			}
		>
			<form id="addon-price" onSubmit={submit} noValidate className="flex flex-col gap-4">
				<SelectField
					label="Billing"
					value={interval}
					onChange={(e) => {
						const i = e.target.value as 'Month' | 'Year';
						setInterval(i);
						if (addOn) load(addOn, i);
					}}
				>
					<option value="Month">Monthly</option>
					<option value="Year">Yearly</option>
				</SelectField>
				<TextField label={addOn?.value !== 'true' ? 'Price per pack (₹)' : 'Price (₹)'} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} error={errors.price} className="tabular" />
				<TextareaField label="Reason (recorded in the audit log)" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} />
				<InlineError message={mutation.error?.message} />
			</form>
		</Modal>
	);
}
