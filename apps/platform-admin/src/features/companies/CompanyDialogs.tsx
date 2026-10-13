import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/Button';
import { OneTimeValue } from '@/components/CopyButton';
import { TextareaField, TextField } from '@/components/Field';
import { Modal } from '@/components/Modal';
import { ReasonDialog } from '@/components/ReasonDialog';
import { InlineError, LoadingState } from '@/components/Surface';
import { useToast } from '@/components/Toast';
import { addOnsToBuy, ONE_BOTH_LICENCE, PlanPicker, PriceSummary, type PlanSelection } from '@/features/plans/PlanPicker';
import { totalLicences } from '@/lib/catalog';
import { api } from '@/lib/api';
import { date, dateTime } from '@/lib/format';
import type { BillingAccount, CompanyDetail, RegistrationCodeResponse } from '@/lib/types';

export function isSuspended(company: CompanyDetail): boolean {
	return company.companyStatus === 'Suspended' || company.subscription?.status === 'Suspended';
}

function useRefreshCompany(id: string) {
	const queryClient = useQueryClient();
	return () => {
		queryClient.invalidateQueries({ queryKey: ['company', id] });
		queryClient.invalidateQueries({ queryKey: ['company-billing', id] });
		queryClient.invalidateQueries({ queryKey: ['companies'] });
		queryClient.invalidateQueries({ queryKey: ['dashboard'] });
		queryClient.invalidateQueries({ queryKey: ['invoices'] });
	};
}

export function SuspendDialog({ company, open, onClose }: { company: CompanyDetail; open: boolean; onClose: () => void }) {
	const toast = useToast();
	const refresh = useRefreshCompany(company.id);
	const suspended = isSuspended(company);
	const mutation = useMutation({
		mutationFn: (reason: string) => api.setCompanyStatus(company.id, suspended ? 'reactivate' : 'suspend', reason),
		onSuccess: () => {
			refresh();
			toast.success(suspended ? `${company.name} reactivated.` : `${company.name} suspended.`);
			onClose();
		},
	});
	useEffect(() => {
		if (open) mutation.reset();
	}, [open]);

	return suspended ? (
		<ReasonDialog
			open={open}
			onClose={onClose}
			title={`Reactivate ${company.name}?`}
			confirmLabel="Reactivate"
			quickReasons={['Payment received', 'Dispute resolved', 'Owner confirmed']}
			placeholder="e.g. Invoice paid by UPI"
			busy={mutation.isPending}
			error={mutation.error?.message}
			onConfirm={(reason) => mutation.mutate(reason)}
		>
			<p className="rounded-md border border-border-subtle bg-surface-alt px-3 py-2.5 text-body text-text-secondary">
				People at this company can sign in again, and its subscription goes back to its previous state.
			</p>
		</ReasonDialog>
	) : (
		<ReasonDialog
			open={open}
			onClose={onClose}
			tone="danger"
			title={`Suspend ${company.name}?`}
			description={`Company ${company.code}`}
			confirmLabel="Suspend"
			quickReasons={['Payment overdue', 'Customer request', 'Security concern']}
			placeholder="e.g. Not paid after repeated reminders"
			busy={mutation.isPending}
			error={mutation.error?.message}
			onConfirm={(reason) => mutation.mutate(reason)}
		>
			<p className="rounded-md border border-danger-strong/30 bg-danger-strong/10 px-3 py-2.5 text-body text-text-primary">
				Nobody at this company can sign in until you reactivate it. <strong className="text-text-heading">No data is deleted.</strong>
			</p>
		</ReasonDialog>
	);
}

export function CancelDialog({ company, open, onClose }: { company: CompanyDetail; open: boolean; onClose: () => void }) {
	const toast = useToast();
	const refresh = useRefreshCompany(company.id);
	const [atPeriodEnd, setAtPeriodEnd] = useState(true);
	const trial = company.subscription?.status === 'Trialing';
	const mutation = useMutation({
		mutationFn: (reason: string) => api.cancelSubscription(company.id, atPeriodEnd, reason),
		onSuccess: () => {
			refresh();
			toast.success(atPeriodEnd ? 'The subscription will end at the end of the paid period.' : 'Subscription canceled.');
			onClose();
		},
	});
	useEffect(() => {
		if (open) {
			setAtPeriodEnd(!trial);
			mutation.reset();
		}
	}, [open]);

	const periodEnd = company.subscription?.currentPeriodEnd;
	return (
		<ReasonDialog
			open={open}
			onClose={onClose}
			tone="danger"
			title="Cancel subscription"
			description={`${company.code} · ${company.name}`}
			confirmLabel="Cancel subscription"
			placeholder="e.g. Closing the business"
			busy={mutation.isPending}
			error={mutation.error?.message}
			onConfirm={(reason) => mutation.mutate(reason)}
		>
			<fieldset className="flex flex-col gap-2">
				<legend className="mb-1 text-label font-medium text-text-primary">When</legend>
				<label className={`flex cursor-pointer gap-3 rounded-md border p-3 ${atPeriodEnd ? 'border-action bg-action/10' : 'border-border-subtle bg-surface-alt'} ${trial ? 'opacity-50' : ''}`}>
					<input type="radio" name="when" checked={atPeriodEnd} disabled={trial} onChange={() => setAtPeriodEnd(true)} className="mt-1 accent-[#3b82f6]" />
					<span>
						<span className="block text-body font-medium text-text-heading">At the end of the paid period{periodEnd ? ` (${date(periodEnd)})` : ''}</span>
						<span className="block text-label text-text-secondary">Recommended. They keep full use until then.</span>
					</span>
				</label>
				<label className={`flex cursor-pointer gap-3 rounded-md border p-3 ${!atPeriodEnd ? 'border-danger-strong/60 bg-danger-strong/10' : 'border-border-subtle bg-surface-alt'}`}>
					<input type="radio" name="when" checked={!atPeriodEnd} onChange={() => setAtPeriodEnd(false)} className="mt-1 accent-[#ef4444]" />
					<span>
						<span className="block text-body font-medium text-text-heading">Now</span>
						<span className="block text-label text-text-secondary">Ends immediately. No refund is made automatically.</span>
					</span>
				</label>
			</fieldset>
			<p className="rounded-md border border-pastdue/30 bg-pastdue-bg px-3 py-2 text-label text-text-primary">
				After it ends, the company keeps read-only access to its data for 90 days.
			</p>
		</ReasonDialog>
	);
}

export function RegistrationCodeDialog({ company, open, onClose }: { company: CompanyDetail; open: boolean; onClose: () => void }) {
	const refresh = useRefreshCompany(company.id);
	const [issued, setIssued] = useState<RegistrationCodeResponse | null>(null);
	const mutation = useMutation({
		mutationFn: () => api.newRegistrationCode(company.id),
		onSuccess: (r) => {
			setIssued(r);
			refresh();
		},
	});
	useEffect(() => {
		if (open) {
			setIssued(null);
			mutation.reset();
		}
	}, [open]);

	if (issued) {
		return (
			<Modal
				open={open}
				onClose={onClose}
				dismissable={false}
				title="New registration code"
				description="Send both codes to the owner by WhatsApp or phone. Any earlier code no longer works."
				footer={
					<Button variant="primary" onClick={onClose}>
						Done
					</Button>
				}
			>
				<div className="flex flex-col gap-3">
					<OneTimeValue label="Company code" value={company.code} />
					<OneTimeValue label="One-time registration code" value={issued.registrationCode} />
					<p className="text-label text-text-secondary">
						Works once; expires on <span className="tabular text-text-heading">{dateTime(issued.expiresAt)}</span>. It is shown only now.
					</p>
				</div>
			</Modal>
		);
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			width="sm"
			title="Issue a new registration code?"
			description={`${company.code} · ${company.name}`}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
						Issue new code
					</Button>
				</>
			}
		>
			<p className="text-body text-text-secondary">The previous registration code stops working. Use this when the owner lost the code or it expired.</p>
			<div className="mt-3">
				<InlineError message={mutation.error?.message} />
			</div>
		</Modal>
	);
}

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function BillingAccountDialog({ company, open, onClose }: { company: CompanyDetail; open: boolean; onClose: () => void }) {
	const toast = useToast();
	const refresh = useRefreshCompany(company.id);
	const empty: BillingAccount = { billingName: company.name, billingEmail: '', billingPhone: '', gstin: '', billingAddress: '', stateCode: '' };
	const [form, setForm] = useState<BillingAccount>(company.billingAccount ?? empty);
	const [errors, setErrors] = useState<Partial<Record<keyof BillingAccount, string>>>({});
	const mutation = useMutation({
		mutationFn: (body: BillingAccount) => api.updateBillingAccount(company.id, body),
		onSuccess: () => {
			refresh();
			toast.success('Billing details saved.');
			onClose();
		},
	});
	useEffect(() => {
		if (open) {
			setForm({ ...empty, ...company.billingAccount });
			setErrors({});
			mutation.reset();
		}
	}, [open]);

	function set<K extends keyof BillingAccount>(key: K, value: string) {
		setForm((f) => ({ ...f, [key]: value }));
	}

	function submit(event: FormEvent) {
		event.preventDefault();
		const next: typeof errors = {};
		const gstin = (form.gstin ?? '').trim().toUpperCase();
		const state = (form.stateCode ?? '').trim();
		const email = (form.billingEmail ?? '').trim();
		if (!form.billingName.trim()) next.billingName = 'A billing name is required.';
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.billingEmail = 'Enter a valid email address.';
		if (gstin && !GSTIN.test(gstin)) next.gstin = 'A GSTIN has 15 characters, like 33ABCDE1234F1Z5.';
		if (state && !/^\d{2}$/.test(state)) next.stateCode = 'Two digits, e.g. 33 for Tamil Nadu.';
		if (gstin && state && gstin.slice(0, 2) !== state) next.stateCode = 'Does not match the first two digits of the GSTIN.';
		setErrors(next);
		if (Object.keys(next).length > 0) return;
		const blank = (v: string | null) => (v && v.trim() ? v.trim() : null);
		mutation.mutate({
			billingName: form.billingName.trim(),
			billingEmail: blank(email),
			billingPhone: blank(form.billingPhone),
			gstin: gstin || null,
			billingAddress: blank(form.billingAddress),
			stateCode: state || (gstin ? gstin.slice(0, 2) : null),
		});
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Billing details"
			description="Printed in the “Bill to” part of Trovo’s invoices to this company."
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="billing-account" variant="primary" loading={mutation.isPending}>
						Save
					</Button>
				</>
			}
		>
			<form id="billing-account" onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<TextField label="Billing name" containerClassName="sm:col-span-2" maxLength={150} value={form.billingName} onChange={(e) => set('billingName', e.target.value)} error={errors.billingName} />
				<TextField label="Billing email" type="email" maxLength={150} value={form.billingEmail ?? ''} onChange={(e) => set('billingEmail', e.target.value)} error={errors.billingEmail} />
				<TextField label="Billing phone" type="tel" maxLength={20} value={form.billingPhone ?? ''} onChange={(e) => set('billingPhone', e.target.value)} />
				<TextField
					label="GSTIN (optional)"
					maxLength={15}
					value={form.gstin ?? ''}
					onChange={(e) => set('gstin', e.target.value.toUpperCase())}
					error={errors.gstin}
					className="font-mono uppercase"
				/>
				<TextField label="State code" maxLength={2} inputMode="numeric" value={form.stateCode ?? ''} onChange={(e) => set('stateCode', e.target.value)} error={errors.stateCode} hint="Taken from the GSTIN when left empty." />
				<TextareaField label="Address" containerClassName="sm:col-span-2" maxLength={500} value={form.billingAddress ?? ''} onChange={(e) => set('billingAddress', e.target.value)} />
				<div className="sm:col-span-2">
					<InlineError message={mutation.error?.message} />
				</div>
			</form>
		</Modal>
	);
}

function selectionFrom(company: CompanyDetail): PlanSelection {
	const s = company.subscription;
	return {
		planCode: s?.plan || 'professional',
		interval: s?.interval === 'Year' ? 'Year' : 'Month',
		addOns: Object.fromEntries((s?.addOns ?? []).map((a) => [a.code, a.quantity])),
		licences: s?.licences && totalLicences(s.licences) > 0 ? s.licences : ONE_BOTH_LICENCE,
	};
}

export function ChangeSubscriptionDialog({ company, open, onClose }: { company: CompanyDetail; open: boolean; onClose: () => void }) {
	const toast = useToast();
	const refresh = useRefreshCompany(company.id);
	const catalog = useQuery({ queryKey: ['plans'], queryFn: api.plans, enabled: open });
	const [selection, setSelection] = useState<PlanSelection>(() => selectionFrom(company));
	const [extendDays, setExtendDays] = useState('');
	const [reason, setReason] = useState('');
	const [errors, setErrors] = useState<{ reason?: string; extend?: string }>({});
	const trial = company.subscription?.status === 'Trialing';
	const mutation = useMutation({
		mutationFn: () => {
			const before = selectionFrom(company);
			const wanted = catalog.data ? addOnsToBuy(catalog.data, selection) : selection.addOns;
			const addOnsChanged = JSON.stringify(Object.entries(before.addOns).sort()) !== JSON.stringify(Object.entries(wanted).sort());
			const licencesChanged = JSON.stringify(before.licences) !== JSON.stringify(selection.licences);
			// The API takes the complete set of add-ons wanted; anything left out ends.
			const addOns = addOnsChanged ? wanted : null;
			return api.changeSubscription(company.id, {
				planCode: selection.planCode !== before.planCode ? selection.planCode : null,
				interval: selection.interval !== before.interval ? selection.interval : null,
				addOns,
				extendTrialDays: trial && extendDays ? Number(extendDays) : null,
				licences: licencesChanged ? selection.licences : null,
				reason: reason.trim(),
			});
		},
		onSuccess: () => {
			refresh();
			toast.success('Subscription updated.');
			onClose();
		},
	});
	useEffect(() => {
		if (open) {
			setSelection(selectionFrom(company));
			setExtendDays('');
			setReason('');
			setErrors({});
			mutation.reset();
		}
	}, [open]);

	const before = selectionFrom(company);
	const changed = JSON.stringify(before) !== JSON.stringify(selection) || (trial && extendDays !== '');

	function submit(event: FormEvent) {
		event.preventDefault();
		const next: typeof errors = {};
		if (!reason.trim()) next.reason = 'A reason is required.';
		if (extendDays && !/^\d+$/.test(extendDays)) next.extend = 'Whole days only.';
		else if (extendDays && (Number(extendDays) < 1 || Number(extendDays) > 90)) next.extend = 'Between 1 and 90 days.';
		setErrors(next);
		if (Object.keys(next).length === 0) mutation.mutate();
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			width="lg"
			title="Change subscription"
			description={`${company.code} · ${company.name}${company.subscription ? ` · now ${company.subscription.planName} ${company.subscription.interval === 'Year' ? 'yearly' : 'monthly'}` : ''}`}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="change-subscription" variant="primary" loading={mutation.isPending} disabled={!changed || !catalog.data || totalLicences(selection.licences) < 1}>
						Save changes
					</Button>
				</>
			}
		>
			{catalog.isPending ? (
				<LoadingState label="Loading plans…" />
			) : catalog.isError ? (
				<InlineError message={catalog.error.message} />
			) : (
				<form id="change-subscription" onSubmit={submit} noValidate className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
					<PlanPicker catalog={catalog.data} value={selection} onChange={setSelection} />
					<div className="flex flex-col gap-4">
						<PriceSummary catalog={catalog.data} selection={selection} title="New price" />
						<p className="text-label text-text-muted">
							{trial
								? 'During the trial nothing is charged; the new plan applies when the first invoice is issued.'
								: 'The new price applies from the next invoice. Nothing already paid is changed.'}
						</p>
						{trial && (
							<TextField
								label="Extend trial by (days)"
								inputMode="numeric"
								placeholder="0"
								value={extendDays}
								onChange={(e) => setExtendDays(e.target.value.replace(/\D/g, ''))}
								error={errors.extend}
								hint={company.subscription?.trialEndsAt ? `Trial ends ${date(company.subscription.trialEndsAt)} now.` : undefined}
							/>
						)}
						<TextareaField
							label="Reason (recorded in the audit log)"
							maxLength={500}
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							error={errors.reason}
							placeholder="e.g. Owner asked for the Showroom module"
						/>
						<InlineError message={mutation.error?.message} />
					</div>
				</form>
			)}
		</Modal>
	);
}
