import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Building2, CheckCircle2, Network, Store } from 'lucide-react';
import { useProduct } from '@/state/product';
import type { Joining, JoiningKind } from '@/lib/types';
import { Alert, Button, TextField } from './ui';

const OPTIONS: {
	kind: JoiningKind;
	title: string;
	text: string;
	icon: typeof Store;
}[] = [
	{
		kind: 'own',
		title: 'My own business',
		text: 'Start fresh with your own company.',
		icon: Store,
	},
	{
		kind: 'franchise',
		title: 'Joining a franchise network',
		text: 'Your franchisor gave you a franchise code.',
		icon: Network,
	},
	{
		kind: 'branch',
		title: 'Adding a branch to my existing account',
		text: 'You are opening another outlet.',
		icon: Building2,
	},
];

/**
 * "How are you joining?" on the first step. A franchise outlet enters the franchisor's code, sees who the franchisor
 * is and what they will see, and must consent. A branch is not signed up here: it is added from inside the app.
 */
export function JoiningChoice({ joining, onChange, error }: { joining: Joining; onChange: (j: Joining) => void; error?: string }) {
	const { api, brand } = useProduct();
	const [code, setCode] = useState(joining.code);
	const check = useMutation({
		mutationFn: () => api.checkFranchiseCode(code),
		onSuccess: (result) =>
			onChange({
				kind: 'franchise',
				code: code.trim(),
				check: result,
				consent: false,
			}),
		onError: () => onChange({ ...joining, code: code.trim(), check: null, consent: false }),
	});

	return (
		<fieldset className="flex flex-col gap-3">
			<legend className="mb-3 text-body font-medium text-text-heading">How are you joining?</legend>
			{OPTIONS.map(({ kind, title, text, icon: Icon }) => {
				const selected = joining.kind === kind;
				return (
					<label
						key={kind}
						className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
							selected ? 'border-action bg-action/10' : 'border-border-subtle bg-surface-alt hover:border-border-strong'
						}`}
					>
						<input
							type="radio"
							name="joining"
							value={kind}
							checked={selected}
							onChange={() =>
								onChange({
									kind,
									code: kind === 'franchise' ? joining.code : '',
									check: kind === 'franchise' ? joining.check : null,
									consent: false,
								})
							}
							className="mt-1 size-4 shrink-0 accent-[#3b82f6]"
						/>
						<Icon className={`mt-0.5 size-5 shrink-0 ${selected ? 'text-action' : 'text-text-muted'}`} aria-hidden />
						<span>
							<span className="block text-body font-semibold text-text-heading">
								{kind === 'own' ? brand.ownBusiness : kind === 'branch' ? `Adding a branch to my existing ${brand.name} account` : title}
							</span>
							<span className="block text-label text-text-secondary">{text}</span>
						</span>
					</label>
				);
			})}

			{joining.kind === 'franchise' && (
				<div className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface-alt p-4">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start">
						<div className="flex-1">
							<TextField
								label="Franchise code"
								required
								placeholder="K7QM-4RTX-9PWD"
								maxLength={20}
								autoComplete="off"
								spellCheck={false}
								value={code}
								onChange={(e) => {
									setCode(e.target.value.toUpperCase());
									if (joining.check) onChange({ ...joining, check: null, consent: false });
								}}
								error={check.isError ? check.error.message : error}
								hint={`Your franchisor makes it in their ${brand.name} app. It works for a short time only.`}
								className="font-mono uppercase tracking-wider"
							/>
						</div>
						<Button className="sm:mt-[30px]" loading={check.isPending} disabled={code.trim().length < 12} onClick={() => check.mutate()}>
							Check code
						</Button>
					</div>

					{joining.check && (
						<div className="flex flex-col gap-3">
							<Alert tone="success">
								<span className="flex items-start gap-2">
									<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-active" aria-hidden />
									<span>
										Franchise of <strong className="text-text-heading">{joining.check.franchisorName}</strong>
									</span>
								</span>
							</Alert>
							<div className="text-body text-text-primary">
								<p className="font-medium text-text-heading">{joining.check.franchisorName} will be able to see:</p>
								<ul className="mt-1.5 list-disc pl-5 text-text-secondary">
									{joining.check.scopes.map((s) => (
										<li key={s.scope}>{s.label}</li>
									))}
								</ul>
								<p className="mt-1.5 text-label text-text-muted">Only these items, read-only. You can switch any of them off later, or end the link, in the app.</p>
							</div>
							<label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-subtle bg-surface-card p-4 text-body text-text-primary">
								<input
									type="checkbox"
									checked={joining.consent}
									onChange={(e) => onChange({ ...joining, consent: e.target.checked })}
									className="mt-0.5 size-5 shrink-0 accent-[#3b82f6]"
								/>
								<span>I allow {joining.check.franchisorName} to see these items.</span>
							</label>
						</div>
					)}
				</div>
			)}

			{joining.kind === 'branch' && (
				<Alert tone="info">
					A branch is part of your existing company, so it is not signed up here. The Owner will add branches from inside the app (coming soon). Until then, call Trovo on +91 90426
					72148.
				</Alert>
			)}
		</fieldset>
	);
}

/** What still stops the business from continuing with this choice, or null. */
export function joiningProblem(joining: Joining): string | null {
	if (joining.kind === 'branch') return 'Branches are added from inside the app.';
	if (joining.kind !== 'franchise') return null;
	if (!joining.check) return 'Enter your franchise code and check it.';
	if (!joining.consent) return 'Tick the box to allow your franchisor to see the listed items, or choose your own business.';
	return null;
}
