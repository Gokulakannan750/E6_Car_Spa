import { useProducts, ChooseProduct } from '@/features/products/ProductProvider';
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { OneTimeValue } from '@/components/CopyButton';
import { TextField } from '@/components/Field';
import { Modal } from '@/components/Modal';
import { InlineError, LoadingState } from '@/components/Surface';
import { addOnsToBuy, minimumSeats, initialSeats, PlanPicker, PriceSummary, type PlanSelection } from '@/features/plans/PlanPicker';
import { totalSeats } from '@/lib/catalog';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import type { CreateCompanyResponse } from '@/lib/types';

type Start = 'trial' | 'paid';

function defaultPaidUntil(interval: 'Month' | 'Year'): string {
	const d = new Date();
	if (interval === 'Year') d.setFullYear(d.getFullYear() + 1);
	else d.setMonth(d.getMonth() + 1);
	return d.toISOString().slice(0, 10);
}

export function NewCompanyModal({ open, onClose, onOpenCompany }: { open: boolean; onClose: () => void; onOpenCompany: (id: string) => void }) {
	const queryClient = useQueryClient();
	const { product } = useProducts();
	const [name, setName] = useState('');
	const [start, setStart] = useState<Start>('trial');
	const [selection, setSelection] = useState<PlanSelection>({ planCode: product?.trialPlanCode ?? '', interval: 'Month', addOns: {}, seats: initialSeats(product) });
	const [paidUntil, setPaidUntil] = useState(defaultPaidUntil('Month'));
	const [nameError, setNameError] = useState<string | null>(null);
	const [created, setCreated] = useState<CreateCompanyResponse | null>(null);
	const catalog = useQuery({ queryKey: ['plans', product?.key], queryFn: () => api.plans(product!.key), enabled: open && start === 'paid' && !!product });

	const create = useMutation({
		mutationFn: () =>
			api.createCompany(
				name.trim(),
				start === 'paid'
					? {
							planCode: selection.planCode,
							interval: selection.interval,
							addOns: catalog.data ? addOnsToBuy(catalog.data, selection) : selection.addOns,
							seats: selection.seats,
							paidUntil: new Date(`${paidUntil}T23:59:59+05:30`).toISOString(),
						}
					: null,
				product!.key,
			),
		onSuccess: (result) => {
			setCreated(result);
			queryClient.invalidateQueries({ queryKey: ['companies'] });
			queryClient.invalidateQueries({ queryKey: ['dashboard'] });
		},
	});

	function reset() {
		setName('');
		setStart('trial');
		setSelection({ planCode: product?.trialPlanCode ?? '', interval: 'Month', addOns: {}, seats: initialSeats(product) });
		setPaidUntil(defaultPaidUntil('Month'));
		setNameError(null);
		setCreated(null);
		create.reset();
	}

	function close() {
		reset();
		onClose();
	}

	function submit(event: FormEvent) {
		event.preventDefault();
		if (!name.trim()) {
			setNameError('Enter the company name.');
			return;
		}
		if (name.trim().length > 200) {
			setNameError('That name is too long.');
			return;
		}
		if (start === 'paid' && (!paidUntil || new Date(paidUntil) <= new Date())) {
			create.reset();
			setNameError(null);
			return;
		}
		setNameError(null);
		create.mutate();
	}

	if (!product)
		return (
			<Modal open={open} onClose={onClose} title="New company">
				<ChooseProduct />
			</Modal>
		);

	if (created) {
		return (
			<Modal
				open={open}
				onClose={close}
				dismissable={false}
				width="md"
				title={
					<span className="flex items-center gap-2">
						<CheckCircle2 className="size-5 text-active" /> {created.name} is ready
					</span>
				}
				description="Its database is created. Send these two codes to the owner by WhatsApp or phone. They enter both in the app on first sign-up."
				footer={
					<>
						<Button
							onClick={() => {
								const id = created.id;
								close();
								onOpenCompany(id);
							}}
						>
							Open company
						</Button>
						<Button variant="primary" onClick={close}>
							Done
						</Button>
					</>
				}
			>
				<div className="flex flex-col gap-3">
					<OneTimeValue label="Company code" value={created.code} />
					<OneTimeValue label="One-time registration code" value={created.registrationCode} />
					<p className="text-label text-text-secondary">
						The registration code works once and expires on <span className="tabular text-text-heading">{dateTime(created.registrationCodeExpiresAt)}</span>. It is shown only now;
						if it is lost, issue a new one from the company page.
					</p>
				</div>
			</Modal>
		);
	}

	const paidUntilInvalid = start === 'paid' && (!paidUntil || new Date(paidUntil) <= new Date());

	return (
		<Modal
			open={open}
			onClose={close}
			width="lg"
			title="New company"
			description="Creates the company’s own database and a one-time registration code for its first sign-up."
			footer={
				<>
					<Button variant="ghost" onClick={close}>
						Cancel
					</Button>
					<Button
						type="submit"
						form="new-company"
						variant="primary"
						loading={create.isPending}
						disabled={start === 'paid' && (!catalog.data || paidUntilInvalid || totalSeats(selection.seats) < minimumSeats(catalog.data, selection, product))}
					>
						Create company
					</Button>
				</>
			}
		>
			{product.seatModel === 'None' && <p className="text-body text-text-secondary">Unlimited seats</p>}
			<form id="new-company" onSubmit={submit} noValidate className="flex flex-col gap-5">
				<TextField
					label="Company name"
					placeholder="e.g. Sunrise Detailing"
					value={name}
					onChange={(e) => setName(e.target.value)}
					error={nameError ?? undefined}
					hint="The business name as the owner wants it on their invoices. They can change it later."
					leading={<Building2 className="size-4" />}
					maxLength={200}
				/>

				<fieldset>
					<legend className="mb-2 text-label font-medium text-text-primary">How does it start?</legend>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup">
						<StartOption
							selected={start === 'trial'}
							onSelect={() => setStart('trial')}
							title="Free trial"
							subtitle={`Trial plan: ${product.trialPlanCode}`}
							detail="No payment now. Users and trial length come from the platform settings. After the trial it needs a paid plan, then the grace days before it becomes read-only."
						/>
						<StartOption
							selected={start === 'paid'}
							onSelect={() => setStart('paid')}
							title="Already paid"
							subtitle="Paid by bank transfer or UPI"
							detail="Choose the plan, seats and add-ons it paid for, and the date it is paid until."
						/>
					</div>
				</fieldset>

				{start === 'paid' &&
					(catalog.isPending ? (
						<LoadingState label="Loading plans…" />
					) : catalog.isError ? (
						<InlineError message={catalog.error.message} />
					) : (
						<div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
							<PlanPicker
								catalog={catalog.data}
								value={selection}
								onChange={(v) => {
									if (v.interval !== selection.interval) setPaidUntil(defaultPaidUntil(v.interval));
									setSelection(v);
								}}
							/>
							<div className="flex flex-col gap-4">
								<PriceSummary catalog={catalog.data} selection={selection} />
								<TextField
									label="Paid until"
									type="date"
									value={paidUntil}
									onChange={(e) => setPaidUntil(e.target.value)}
									error={paidUntilInvalid ? 'Choose a date after today.' : undefined}
									hint="Renewal invoices start 7 days before this date."
								/>
							</div>
						</div>
					))}

				<InlineError message={create.error?.message} />
			</form>
		</Modal>
	);
}

function StartOption({ selected, onSelect, title, subtitle, detail }: { selected: boolean; onSelect: () => void; title: string; subtitle: string; detail: string }) {
	return (
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			onClick={onSelect}
			className={`rounded-lg border p-4 text-left transition-colors ${selected ? 'border-action bg-action/10 ring-1 ring-action' : 'border-border-subtle bg-surface-alt hover:border-text-muted'}`}
		>
			<div className="text-body font-semibold text-text-heading">{title}</div>
			<div className="mt-0.5 text-body text-action">{subtitle}</div>
			<div className="mt-2 text-label text-text-secondary">{detail}</div>
		</button>
	);
}
