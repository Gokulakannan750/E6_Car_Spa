import { useProduct, usePaths } from '@/state/product';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Page, PrivacyNote, Steps } from '@/components/Frame';
import { JoiningChoice, joiningProblem } from '@/components/JoiningChoice';
import { Button, Card, SelectField, TextField } from '@/components/ui';
import { INDIAN_STATES, validateBusiness } from '@/lib/rules';
import type { Business } from '@/lib/types';
import { useSignup } from '@/state/signup';

export function BusinessStep() {
	const { catalog: definition, brand: links } = useProduct();
	const paths = usePaths();
	const navigate = useNavigate();
	const { business, setBusiness, joining, setJoining } = useSignup();
	const [form, setForm] = useState<Business>(business);
	const [errors, setErrors] = useState<Partial<Record<keyof Business, string>>>({});
	const [joiningError, setJoiningError] = useState<string | undefined>();

	useEffect(() => {
		document.title = 'Your business · ' + links.name;
	}, []);

	const set = (key: keyof Business) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		setForm((f) => ({ ...f, [key]: e.target.value }));
		if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
	};

	function submit(event: FormEvent) {
		event.preventDefault();
		const problem = definition.capabilities.includes('franchise') ? joiningProblem(joining) : null;
		setJoiningError(problem ?? undefined);
		if (problem) return;
		const found = validateBusiness(form);
		setErrors(found);
		if (Object.keys(found).length > 0) {
			document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
			return;
		}
		setBusiness({
			...form,
			gstin: form.gstin.trim().toUpperCase(),
			email: form.email.trim(),
		});
		navigate(paths.step('plan'));
	}

	return (
		<Page>
			<Steps current={1} />
			<Card className="mx-auto max-w-[720px] p-6 sm:p-10">
				<h1 className="text-headline font-semibold text-text-heading sm:text-display">Tell us about your business</h1>
				<p className="mt-2 text-body text-text-secondary">It takes about 3 minutes.</p>
				<form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-5">
					{definition.capabilities.includes('franchise') && (
						<JoiningChoice
							joining={joining}
							onChange={(j) => {
								setJoining(j);
								setJoiningError(undefined);
							}}
							error={joining.kind === 'franchise' && !joining.check ? joiningError : undefined}
						/>
					)}
					{joining.kind !== 'branch' && (
						<>
							<TextField
								label="Business name"
								required
								autoComplete="organization"
								placeholder="Your business name"
								maxLength={150}
								value={form.name}
								onChange={set('name')}
								error={errors.name}
								hint="Shown on your invoices. You can change it later."
							/>
							<TextField
								label="Your name"
								required
								autoComplete="name"
								placeholder="Arun Kumar"
								maxLength={150}
								value={form.ownerName}
								onChange={set('ownerName')}
								error={errors.ownerName}
							/>
							<TextField
								label="Mobile number"
								required
								type="tel"
								inputMode="tel"
								autoComplete="tel-national"
								prefix="+91"
								placeholder="98765 43210"
								maxLength={16}
								value={form.mobile}
								onChange={set('mobile')}
								error={errors.mobile}
							/>
							<TextField
								label="Email"
								required
								type="email"
								autoComplete="email"
								placeholder="arun@sunrisedetailing.in"
								maxLength={150}
								value={form.email}
								onChange={set('email')}
								error={errors.email}
								hint="We send your invoices and receipts here."
							/>
							<div className="grid gap-5 sm:grid-cols-2">
								<TextField label="City" required autoComplete="address-level2" placeholder="Erode" maxLength={80} value={form.city} onChange={set('city')} error={errors.city} />
								<SelectField label="State" required autoComplete="address-level1" value={form.state} onChange={set('state')} error={errors.state}>
									<option value="">Choose…</option>
									{INDIAN_STATES.map((s) => (
										<option key={s}>{s}</option>
									))}
								</SelectField>
							</div>
							<TextField
								label="GSTIN"
								optional
								placeholder="33ABCDE1234F1Z5"
								maxLength={15}
								value={form.gstin}
								onChange={(e) => {
									setForm((f) => ({
										...f,
										gstin: e.target.value.toUpperCase(),
									}));
									if (errors.gstin) setErrors((x) => ({ ...x, gstin: undefined }));
								}}
								error={errors.gstin}
								hint="Only if you want it on Trovo's invoices to you."
								className="font-mono uppercase"
							/>
							{joiningError && joining.kind === 'franchise' && joining.check && !joining.consent && (
								<p role="alert" className="text-label text-danger">
									{joiningError}
								</p>
							)}
						</>
					)}
					<div className="mt-2 flex flex-col-reverse gap-3 border-t border-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
						<Button variant="ghost" onClick={() => navigate(paths.pricing)} icon={undefined}>
							<ArrowLeft className="size-4" aria-hidden /> Back to plans
						</Button>
						{joining.kind !== 'branch' && (
							<Button type="submit" variant="primary" icon={<ArrowRight className="size-4" />}>
								Continue
							</Button>
						)}
					</div>
				</form>
			</Card>
			<PrivacyNote />
		</Page>
	);
}
