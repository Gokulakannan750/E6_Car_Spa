import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleSlash, History, Plus, Tag } from 'lucide-react';
import { useBreadcrumbs } from '@/app/layout/Breadcrumbs';
import { Button } from '@/components/Button';
import { SelectField, TextareaField, TextField } from '@/components/Field';
import { Modal } from '@/components/Modal';
import { ReasonDialog } from '@/components/ReasonDialog';
import { Badge } from '@/components/StatusBadge';
import { Card, CardHeader, ErrorState, InlineError, LoadingState, PageHeader } from '@/components/Surface';
import { useToast } from '@/components/Toast';
import { useAuth, BILLING_ROLES } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { APP_ACCESS, BOOLEAN_FEATURES, featureLabel } from '@/lib/catalog';
import { date, intervalLabel, moneyShort, parseRupees } from '@/lib/format';
import type { AddOn, Plan, PlanVersion } from '@/lib/types';
import { currentAddOnPrice, currentVersion, licencePrice } from './PlanPicker';

type Toggle = { kind: 'plan'; plan: Plan } | { kind: 'addon'; addOn: AddOn } | null;

export function PlansPage() {
	useBreadcrumbs({ label: 'Plans & Prices' });
	const { can } = useAuth();
	const toast = useToast();
	const queryClient = useQueryClient();
	const catalog = useQuery({ queryKey: ['plans'], queryFn: api.plans });
	const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
	const [editingAddOn, setEditingAddOn] = useState<AddOn | null>(null);
	const [creatingPlan, setCreatingPlan] = useState(false);
	const [creatingAddOn, setCreatingAddOn] = useState(false);
	const [toggle, setToggle] = useState<Toggle>(null);
	const billingRole = can(...BILLING_ROLES);

	const toggleMutation = useMutation({
		mutationFn: (reason: string) =>
			toggle!.kind === 'plan'
				? api.updatePlan(toggle!.plan.code, { isActive: !toggle!.plan.isActive, reason })
				: api.updateAddOn(toggle!.addOn.code, { isActive: !toggle!.addOn.isActive, reason }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['plans'] });
			toast.success('Saved.');
			setToggle(null);
		},
	});
	useEffect(() => {
		toggleMutation.reset();
	}, [toggle]);

	const selling = toggle ? (toggle.kind === 'plan' ? toggle.plan.isActive : toggle.addOn.isActive) : false;
	const toggleName = toggle ? (toggle.kind === 'plan' ? toggle.plan.name : toggle.addOn.name) : '';

	return (
		<>
			<PageHeader
				title="Plans & Prices"
				description="Prices are per user licence (Android, Windows, or both apps). A new price applies to new subscriptions and to existing ones from their next renewal; old prices stay in the history."
				actions={
					billingRole && (
						<>
							<Button icon={<Plus className="size-4" />} onClick={() => setCreatingAddOn(true)}>
								New add-on
							</Button>
							<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreatingPlan(true)}>
								New plan
							</Button>
						</>
					)
				}
			/>
			{catalog.isPending ? (
				<LoadingState />
			) : catalog.isError ? (
				<ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />
			) : (
				<>
					<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
						{catalog.data.plans.map((plan) => (
							<PlanCard
								key={plan.id}
								plan={plan}
								onNewPrice={billingRole ? () => setEditingPlan(plan) : undefined}
								onToggle={billingRole ? () => setToggle({ kind: 'plan', plan }) : undefined}
							/>
						))}
					</div>

					<Card className="mt-6">
						<CardHeader title="Add-ons" subtitle="Bought on top of a plan. A plan that already includes a module cannot buy it again." />
						<div className="overflow-x-auto">
							<table className="w-full text-table">
								<thead>
									<tr className="border-b border-border-subtle text-left text-label font-semibold tracking-[0.04em] text-text-muted uppercase">
										<th className="h-10 px-5">Add-on</th>
										<th className="h-10 px-4">Gives</th>
										<th className="h-10 px-4 text-right">Monthly</th>
										<th className="h-10 px-4 text-right">Yearly</th>
										<th className="h-10 px-4">Status</th>
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
											<tr key={addOn.id} className={`h-11 border-b border-border-hairline last:border-b-0 ${addOn.isActive ? '' : 'text-text-muted'}`}>
												<td className="px-5 py-2">
													<div className={`font-medium ${addOn.isActive ? 'text-text-heading' : ''}`}>{addOn.name}</div>
													<div className="font-mono text-micro text-text-muted">{addOn.code}</div>
												</td>
												<td className="px-4 py-2 text-text-secondary">
													{featureLabel(addOn.featureKey)}
													{addOn.value !== 'true' && <span className="ml-1">+{addOn.value}</span>}
												</td>
												<td className="tabular px-4 py-2 text-right">{month ? moneyShort(month.unitPriceMinor, month.currency) : '—'}</td>
												<td className="tabular px-4 py-2 text-right">{year ? moneyShort(year.unitPriceMinor, year.currency) : '—'}</td>
												<td className="px-4 py-2">{addOn.isActive ? <Badge tone="active">On sale</Badge> : <Badge tone="canceled">Not sold</Badge>}</td>
												<td className="px-5 py-2 text-right">
													{billingRole && (
														<div className="flex justify-end gap-1">
															<Button size="sm" variant="ghost" onClick={() => setToggle({ kind: 'addon', addOn })}>
																{addOn.isActive ? 'Stop selling' : 'Sell again'}
															</Button>
															<Button size="sm" onClick={() => setEditingAddOn(addOn)}>
																New price
															</Button>
														</div>
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
			<NewPlanDialog open={creatingPlan} onClose={() => setCreatingPlan(false)} />
			<NewAddOnDialog open={creatingAddOn} onClose={() => setCreatingAddOn(false)} />
			<ReasonDialog
				open={toggle !== null}
				onClose={() => setToggle(null)}
				tone={selling ? 'danger' : 'primary'}
				title={selling ? `Stop selling ${toggleName}?` : `Sell ${toggleName} again?`}
				confirmLabel={selling ? 'Stop selling' : 'Sell again'}
				busy={toggleMutation.isPending}
				error={toggleMutation.error?.message}
				onConfirm={(reason) => toggleMutation.mutate(reason)}
			>
				<p className="text-body text-text-secondary">
					{selling
						? 'It can no longer be chosen for new or changed subscriptions. Companies that already have it keep it.'
						: 'It can be chosen again for subscriptions.'}
				</p>
			</ReasonDialog>
		</>
	);
}

function PlanCard({ plan, onNewPrice, onToggle }: { plan: Plan; onNewPrice?: () => void; onToggle?: () => void }) {
	const [showHistory, setShowHistory] = useState(false);
	const month = currentVersion(plan.versions, 'Month');
	const year = currentVersion(plan.versions, 'Year');
	const reference = month ?? year;
	const history = [...plan.versions].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

	return (
		<Card className={plan.isActive ? '' : 'opacity-70'}>
			<CardHeader
				title={
					<span className="flex items-center gap-2">
						<Tag className="size-4 text-action" /> {plan.name}
						{!plan.isActive && <Badge tone="canceled">Not sold</Badge>}
					</span>
				}
				subtitle={<span className="font-mono">{plan.code}</span>}
				actions={
					<>
						{onToggle && (
							<Button size="sm" variant="ghost" onClick={onToggle}>
								{plan.isActive ? 'Stop selling' : 'Sell again'}
							</Button>
						)}
						{onNewPrice && (
							<Button size="sm" onClick={onNewPrice}>
								New price
							</Button>
						)}
					</>
				}
			/>
			<div className="p-5">
				<table className="w-full text-table">
					<thead>
						<tr className="text-left text-micro font-semibold tracking-[0.04em] text-text-muted uppercase">
							<th className="pb-2">Per user licence</th>
							<th className="pb-2 text-right">Monthly</th>
							<th className="pb-2 text-right">Yearly</th>
						</tr>
					</thead>
					<tbody className="tabular">
						{APP_ACCESS.map((type) => (
							<tr key={type.key} className="border-t border-border-hairline">
								<td className="py-2 text-text-primary">{type.label}</td>
								<td className="py-2 text-right text-text-heading">{month ? moneyShort(licencePrice(month, type.key)) : '—'}</td>
								<td className="py-2 text-right text-text-heading">{year ? moneyShort(licencePrice(year, type.key)) : '—'}</td>
							</tr>
						))}
						{(month?.priceMinor ?? 0) + (year?.priceMinor ?? 0) > 0 && (
							<tr className="border-t border-border-hairline">
								<td className="py-2 text-text-primary">Company fee</td>
								<td className="py-2 text-right">{month ? moneyShort(month.priceMinor) : '—'}</td>
								<td className="py-2 text-right">{year ? moneyShort(year.priceMinor) : '—'}</td>
							</tr>
						)}
					</tbody>
				</table>
				{reference && (
					<>
						<div className="mt-5 mb-2 text-micro font-medium tracking-wide text-text-muted uppercase">Includes</div>
						<ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
							<li className="flex items-center gap-2 text-body text-text-heading">
								<CheckCircle2 className="size-4 text-active" /> At least {reference.includedSeats} user licence{reference.includedSeats === 1 ? '' : 's'}
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
								<th className="h-8 pr-3 text-right">Both / Win / Android</th>
								<th className="h-8">In force</th>
							</tr>
						</thead>
						<tbody className="tabular">
							{history.map((v) => (
								<tr key={v.id} className={`h-8 border-b border-border-hairline last:border-b-0 ${v.effectiveTo ? 'text-text-muted' : 'text-text-primary'}`}>
									<td className="pr-3">v{v.version}</td>
									<td className="pr-3">{intervalLabel(v.interval)}</td>
									<td className="pr-3 text-right">
										{moneyShort(v.bothUserPriceMinor)} / {moneyShort(v.windowsUserPriceMinor)} / {moneyShort(v.androidUserPriceMinor)}
										{v.priceMinor > 0 && ` + ${moneyShort(v.priceMinor)} fee`}
									</td>
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

interface PriceFields {
	fee: string;
	android: string;
	windows: string;
	both: string;
}

const rupees = (minor: number) => (minor / 100).toString();

function pricesFrom(v: PlanVersion | undefined): PriceFields {
	return v
		? { fee: rupees(v.priceMinor), android: rupees(v.androidUserPriceMinor), windows: rupees(v.windowsUserPriceMinor), both: rupees(v.bothUserPriceMinor) }
		: { fee: '0', android: '', windows: '', both: '' };
}

/** Reads the four price boxes; returns paise or an error per box. */
function readPrices(fields: PriceFields): { values?: { fee: number; android: number; windows: number; both: number }; errors: Partial<Record<keyof PriceFields, string>> } {
	const errors: Partial<Record<keyof PriceFields, string>> = {};
	const read = (key: keyof PriceFields) => {
		const value = parseRupees(fields[key] || '0');
		if (value === null) errors[key] = 'Enter rupees, e.g. 999.';
		return value ?? 0;
	};
	const values = { fee: read('fee'), android: read('android'), windows: read('windows'), both: read('both') };
	if (Object.keys(errors).length === 0 && values.fee + values.android + values.windows + values.both === 0) {
		errors.both = 'Give the plan a price.';
	}
	return Object.keys(errors).length > 0 ? { errors } : { values, errors };
}

function PriceBoxes({ value, onChange, errors, prefix = '' }: { value: PriceFields; onChange: (v: PriceFields) => void; errors: Partial<Record<keyof PriceFields, string>>; prefix?: string }) {
	const set = (key: keyof PriceFields) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [key]: e.target.value });
	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
			<TextField label={`${prefix}Windows + Android (₹)`} inputMode="decimal" value={value.both} onChange={set('both')} error={errors.both} className="tabular" />
			<TextField label={`${prefix}Windows only (₹)`} inputMode="decimal" value={value.windows} onChange={set('windows')} error={errors.windows} className="tabular" />
			<TextField label={`${prefix}Android only (₹)`} inputMode="decimal" value={value.android} onChange={set('android')} error={errors.android} className="tabular" />
			<TextField label={`${prefix}Company fee (₹)`} inputMode="decimal" value={value.fee} onChange={set('fee')} error={errors.fee} hint="Usually 0" className="tabular" />
		</div>
	);
}

function FeatureTicks({ value, onChange }: { value: Record<string, boolean>; onChange: (v: Record<string, boolean>) => void }) {
	return (
		<fieldset>
			<legend className="mb-2 text-label font-medium text-text-primary">Modules included</legend>
			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
				{BOOLEAN_FEATURES.map((key) => (
					<label key={key} className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-alt px-3 py-2 text-body text-text-primary">
						<input type="checkbox" checked={!!value[key]} onChange={(e) => onChange({ ...value, [key]: e.target.checked })} className="size-4 accent-[#3b82f6]" />
						{featureLabel(key)}
					</label>
				))}
			</div>
		</fieldset>
	);
}

function PlanPriceDialog({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
	const toast = useToast();
	const queryClient = useQueryClient();
	const [interval, setInterval] = useState<'Month' | 'Year'>('Month');
	const [prices, setPrices] = useState<PriceFields>(pricesFrom(undefined));
	const [minimum, setMinimum] = useState('1');
	const [features, setFeatures] = useState<Record<string, boolean>>({});
	const [reason, setReason] = useState('');
	const [errors, setErrors] = useState<Partial<Record<keyof PriceFields | 'minimum' | 'reason', string>>>({});

	function load(p: Plan, i: 'Month' | 'Year') {
		const v = currentVersion(p.versions, i);
		setPrices(pricesFrom(v));
		setMinimum(String(v?.includedSeats ?? 1));
		setFeatures(Object.fromEntries(BOOLEAN_FEATURES.map((k) => [k, v?.entitlements.find((e) => e.featureKey === k)?.value === 'true'])));
	}

	const mutation = useMutation({
		mutationFn: (body: Parameters<typeof api.newPlanVersion>[1]) => api.newPlanVersion(plan!.code, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['plans'] });
			toast.success(`New ${interval === 'Month' ? 'monthly' : 'yearly'} price saved for ${plan!.name}.`);
			onClose();
		},
	});

	useEffect(() => {
		if (plan) {
			setInterval('Month');
			load(plan, 'Month');
			setReason('');
			setErrors({});
			mutation.reset();
		}
	}, [plan?.id]);

	function submit(event: FormEvent) {
		event.preventDefault();
		const read = readPrices(prices);
		const next: typeof errors = { ...read.errors };
		if (!/^\d+$/.test(minimum) || Number(minimum) < 1 || Number(minimum) > 100) next.minimum = 'A whole number from 1 to 100.';
		if (!reason.trim()) next.reason = 'A reason is required.';
		setErrors(next);
		if (Object.keys(next).length > 0 || !read.values) return;
		mutation.mutate({
			interval,
			priceMinor: read.values.fee,
			includedSeats: Number(minimum),
			androidUserPriceMinor: read.values.android,
			windowsUserPriceMinor: read.values.windows,
			bothUserPriceMinor: read.values.both,
			entitlements: Object.fromEntries(BOOLEAN_FEATURES.map((k) => [k, features[k] ? 'true' : 'false'])),
			reason: reason.trim(),
		});
	}

	return (
		<Modal
			open={plan !== null}
			onClose={onClose}
			width="lg"
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
			<form id="plan-price" onSubmit={submit} noValidate className="flex flex-col gap-4">
				<div className="grid grid-cols-2 gap-3">
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
					<TextField label="Minimum user licences" inputMode="numeric" value={minimum} onChange={(e) => setMinimum(e.target.value.replace(/\D/g, ''))} error={errors.minimum} />
				</div>
				<PriceBoxes value={prices} onChange={setPrices} errors={errors} />
				<FeatureTicks value={features} onChange={setFeatures} />
				<TextareaField label="Reason (recorded in the audit log)" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} placeholder="e.g. Price revision for 2027" />
				<InlineError message={mutation.error?.message} />
			</form>
		</Modal>
	);
}

function NewPlanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const toast = useToast();
	const queryClient = useQueryClient();
	const [name, setName] = useState('');
	const [code, setCode] = useState('');
	const [codeTouched, setCodeTouched] = useState(false);
	const [minimum, setMinimum] = useState('1');
	const [monthly, setMonthly] = useState<PriceFields>(pricesFrom(undefined));
	const [yearly, setYearly] = useState<PriceFields>(pricesFrom(undefined));
	const [features, setFeatures] = useState<Record<string, boolean>>({});
	const [reason, setReason] = useState('');
	const [errors, setErrors] = useState<Record<string, string>>({});

	const mutation = useMutation({
		mutationFn: api.createPlan,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['plans'] });
			toast.success(`Plan ${name.trim()} created.`);
			onClose();
		},
	});

	useEffect(() => {
		if (open) {
			setName('');
			setCode('');
			setCodeTouched(false);
			setMinimum('1');
			setMonthly(pricesFrom(undefined));
			setYearly(pricesFrom(undefined));
			setFeatures({});
			setReason('');
			setErrors({});
			mutation.reset();
		}
	}, [open]);

	const suggestedCode = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 39);

	function submit(event: FormEvent) {
		event.preventDefault();
		const finalCode = codeTouched ? code : suggestedCode;
		const m = readPrices(monthly);
		const y = readPrices(yearly);
		const next: Record<string, string> = {};
		if (name.trim().length < 2) next.name = 'Enter the plan name.';
		if (!/^[a-z][a-z0-9_]{1,38}$/.test(finalCode)) next.code = 'Lowercase letters, digits and _ only, starting with a letter.';
		if (!/^\d+$/.test(minimum) || Number(minimum) < 1 || Number(minimum) > 100) next.minimum = 'A whole number from 1 to 100.';
		for (const [k, v] of Object.entries(m.errors)) next[`m_${k}`] = v!;
		for (const [k, v] of Object.entries(y.errors)) next[`y_${k}`] = v!;
		if (!reason.trim()) next.reason = 'A reason is required.';
		setErrors(next);
		if (Object.keys(next).length > 0 || !m.values || !y.values) return;
		const terms = (v: NonNullable<typeof m.values>) => ({
			companyFeeMinor: v.fee,
			androidUserPriceMinor: v.android,
			windowsUserPriceMinor: v.windows,
			bothUserPriceMinor: v.both,
		});
		mutation.mutate({
			code: finalCode,
			name: name.trim(),
			minimumLicences: Number(minimum),
			monthly: terms(m.values),
			yearly: terms(y.values),
			features: Object.fromEntries(BOOLEAN_FEATURES.map((k) => [k, features[k] ? 'true' : 'false'])),
			reason: reason.trim(),
		});
	}

	const pick = (prefix: string) =>
		Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v])) as Partial<Record<keyof PriceFields, string>>;

	return (
		<Modal
			open={open}
			onClose={onClose}
			width="lg"
			title="New plan"
			description="Offered for new and changed subscriptions straight away. Prices are per user licence."
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="new-plan" variant="primary" loading={mutation.isPending}>
						Create plan
					</Button>
				</>
			}
		>
			<form id="new-plan" onSubmit={submit} noValidate className="flex flex-col gap-4">
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<TextField label="Name" placeholder="e.g. Enterprise" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
					<TextField
						label="Code"
						maxLength={39}
						value={codeTouched ? code : suggestedCode}
						onChange={(e) => {
							setCodeTouched(true);
							setCode(e.target.value.toLowerCase());
						}}
						error={errors.code}
						hint="Fixed once created"
						className="font-mono"
					/>
					<TextField label="Minimum user licences" inputMode="numeric" value={minimum} onChange={(e) => setMinimum(e.target.value.replace(/\D/g, ''))} error={errors.minimum} />
				</div>
				<div>
					<div className="mb-2 text-label font-semibold text-text-heading">Monthly prices</div>
					<PriceBoxes value={monthly} onChange={setMonthly} errors={pick('m_')} />
				</div>
				<div>
					<div className="mb-2 flex items-center justify-between">
						<span className="text-label font-semibold text-text-heading">Yearly prices</span>
						<button
							type="button"
							className="text-label text-action hover:text-action-hover"
							onClick={() => {
								const times10 = (v: string) => {
									const minor = parseRupees(v || '0');
									return minor === null ? v : rupees(minor * 10);
								};
								setYearly({ fee: times10(monthly.fee), android: times10(monthly.android), windows: times10(monthly.windows), both: times10(monthly.both) });
							}}
						>
							Fill as 10 × monthly
						</button>
					</div>
					<PriceBoxes value={yearly} onChange={setYearly} errors={pick('y_')} />
				</div>
				<FeatureTicks value={features} onChange={setFeatures} />
				<TextareaField label="Reason (recorded in the audit log)" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} />
				<InlineError message={mutation.error?.message} />
			</form>
		</Modal>
	);
}

/** Features a new add-on can unlock: the modules, plus more franchise branches (a pack). */
const ADD_ON_FEATURES: { key: string; label: string; pack?: boolean }[] = [
	...BOOLEAN_FEATURES.map((key) => ({ key, label: featureLabel(key) })),
	{ key: 'franchise_network.max_branches', label: 'More franchise branches (pack)', pack: true },
];

function NewAddOnDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const toast = useToast();
	const queryClient = useQueryClient();
	const [name, setName] = useState('');
	const [code, setCode] = useState('');
	const [feature, setFeature] = useState(ADD_ON_FEATURES[0]!.key);
	const [perUnit, setPerUnit] = useState('10');
	const [monthly, setMonthly] = useState('');
	const [yearly, setYearly] = useState('');
	const [reason, setReason] = useState('');
	const [errors, setErrors] = useState<Record<string, string>>({});
	const pack = ADD_ON_FEATURES.find((f) => f.key === feature)?.pack ?? false;

	const mutation = useMutation({
		mutationFn: api.createAddOn,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['plans'] });
			toast.success(`Add-on ${name.trim()} created.`);
			onClose();
		},
	});

	useEffect(() => {
		if (open) {
			setName('');
			setCode('');
			setFeature(ADD_ON_FEATURES[0]!.key);
			setPerUnit('10');
			setMonthly('');
			setYearly('');
			setReason('');
			setErrors({});
			mutation.reset();
		}
	}, [open]);

	function submit(event: FormEvent) {
		event.preventDefault();
		const next: Record<string, string> = {};
		const m = parseRupees(monthly);
		const y = parseRupees(yearly);
		if (name.trim().length < 2) next.name = 'Enter the add-on name.';
		if (!/^[a-z][a-z0-9_]{1,38}$/.test(code)) next.code = 'Lowercase letters, digits and _ only, starting with a letter.';
		if (pack && (!/^\d+$/.test(perUnit) || Number(perUnit) < 1 || Number(perUnit) > 1000)) next.perUnit = 'A whole number from 1 to 1000.';
		if (m === null) next.monthly = 'Enter rupees, e.g. 299.';
		if (y === null) next.yearly = 'Enter rupees, e.g. 2990.';
		if (!reason.trim()) next.reason = 'A reason is required.';
		setErrors(next);
		if (Object.keys(next).length > 0 || m === null || y === null) return;
		mutation.mutate({ code, name: name.trim(), featureKey: feature, value: pack ? perUnit : 'true', monthlyPriceMinor: m, yearlyPriceMinor: y, reason: reason.trim() });
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="New add-on"
			description="Unlocks one of the software's modules on top of a plan. A plan that already includes the module cannot buy it."
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="new-addon" variant="primary" loading={mutation.isPending}>
						Create add-on
					</Button>
				</>
			}
		>
			<form id="new-addon" onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<TextField label="Name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} containerClassName="sm:col-span-2" />
				<TextField label="Code" maxLength={39} value={code} onChange={(e) => setCode(e.target.value.toLowerCase())} error={errors.code} hint="Fixed once created" className="font-mono" />
				<SelectField label="Unlocks" value={feature} onChange={(e) => setFeature(e.target.value)}>
					{ADD_ON_FEATURES.map((f) => (
						<option key={f.key} value={f.key}>
							{f.label}
						</option>
					))}
				</SelectField>
				{pack && <TextField label="Branches per pack" inputMode="numeric" value={perUnit} onChange={(e) => setPerUnit(e.target.value)} error={errors.perUnit} />}
				<TextField label="Monthly price (₹)" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} error={errors.monthly} className="tabular" />
				<TextField label="Yearly price (₹)" inputMode="decimal" value={yearly} onChange={(e) => setYearly(e.target.value)} error={errors.yearly} className="tabular" />
				<TextareaField label="Reason (recorded in the audit log)" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} containerClassName="sm:col-span-2" />
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
		setPrice(p ? rupees(p.unitPriceMinor) : '');
	}

	const mutation = useMutation({
		mutationFn: (body: Parameters<typeof api.newAddOnPrice>[1]) => api.newAddOnPrice(addOn!.code, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['plans'] });
			toast.success(`New price saved for ${addOn!.name}.`);
			onClose();
		},
	});

	useEffect(() => {
		if (addOn) {
			setInterval('Month');
			load(addOn, 'Month');
			setReason('');
			setErrors({});
			mutation.reset();
		}
	}, [addOn?.id]);

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
