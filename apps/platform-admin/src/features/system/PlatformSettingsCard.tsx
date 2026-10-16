import { useProducts, ChooseProduct } from '@/features/products/ProductProvider';
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/Button';
import { TextareaField, TextField } from '@/components/Field';
import { Card, CardHeader, ErrorState, InlineError, LoadingState } from '@/components/Surface';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import type { PlatformSettings } from '@/lib/types';

/** Same limits as the API (PlatformSettingsService.Limits). */
const FIELDS: { key: keyof PlatformSettings; label: string; hint: string; min: number; max: number }[] = [
	{ key: 'trialDays', label: 'Free trial (days)', hint: 'The product’s configured trial plan for a new company.', min: 1, max: 60 },
	{ key: 'trialLicences', label: 'Users during the trial', hint: 'Seat quantity for a trial company.', min: 1, max: 50 },
	{ key: 'graceDays', label: 'Grace after an unpaid period (days)', hint: 'Full access with a warning, then read-only.', min: 0, max: 60 },
	{ key: 'renewalInvoiceDaysBefore', label: 'Renewal invoice (days before)', hint: 'When the next invoice is issued.', min: 1, max: 30 },
	{ key: 'franchiseCodeMinutes', label: 'Franchise code lifetime (minutes)', hint: 'How long a franchise sign-up code works. 60 = 1 hour.', min: 10, max: 10080 },
];

export function PlatformSettingsCard() {
	const { product } = useProducts();
	const fields = FIELDS.filter(
		(f) => (f.key !== 'trialLicences' || product?.seatModel !== 'None') && (f.key !== 'franchiseCodeMinutes' || product?.capabilities.includes('franchise')),
	).map((f) => (f.key === 'trialLicences' ? { ...f, label: `Trial ${product?.seatModel === 'Counted' ? (product.seatTypes[0]?.name ?? 'seats') : 'seats'}` } : f));
	const toast = useToast();
	const queryClient = useQueryClient();
	const settings = useQuery({ queryKey: ['settings', product?.key], queryFn: () => api.settings(product!.key), enabled: !!product });
	const [values, setValues] = useState<Record<string, string>>({});
	const [reason, setReason] = useState('');
	const [errors, setErrors] = useState<Record<string, string>>({});

	useEffect(() => {
		if (settings.data) setValues(Object.fromEntries(fields.map((f) => [f.key, String(settings.data[f.key])])));
	}, [settings.data]);

	const save = useMutation({
		mutationFn: (body: Parameters<typeof api.updateSettings>[0]) => api.updateSettings(body, product!.key),
		onSuccess: (saved) => {
			queryClient.setQueryData(['settings', product?.key], saved);
			setReason('');
			toast.success('Settings saved. They apply to new trials and the next checks.');
		},
	});

	const changed = settings.data ? fields.filter((f) => values[f.key] !== String(settings.data[f.key])) : [];

	function submit(event: FormEvent) {
		event.preventDefault();
		const next: Record<string, string> = {};
		const body: Partial<PlatformSettings> = {};
		for (const f of changed) {
			const n = Number(values[f.key]);
			if (!/^\d+$/.test(values[f.key] ?? '') || n < f.min || n > f.max) next[f.key] = `Between ${f.min} and ${f.max}.`;
			else body[f.key] = n;
		}
		if (!reason.trim()) next.reason = 'A reason is required.';
		setErrors(next);
		if (Object.keys(next).length === 0) save.mutate({ ...body, reason: reason.trim() });
	}

	if (!product) return <ChooseProduct />;
	return (
		<Card className="mb-6">
			<CardHeader title={`Subscription settings · ${product.name}`} subtitle="Changes apply to new trials and to the next lifecycle checks; existing trials keep their end date." />
			{settings.isPending ? (
				<LoadingState />
			) : settings.isError ? (
				<ErrorState error={settings.error} onRetry={() => settings.refetch()} />
			) : (
				<form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
					{fields.map((f) => (
						<TextField
							key={f.key}
							label={f.label}
							inputMode="numeric"
							value={values[f.key] ?? ''}
							onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value.replace(/\D/g, '') }))}
							error={errors[f.key]}
							hint={f.hint}
						/>
					))}
					{changed.length > 0 && (
						<>
							<TextareaField
								label="Reason (recorded in the audit log)"
								containerClassName="md:col-span-2 xl:col-span-3"
								maxLength={500}
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								error={errors.reason}
							/>
							<div className="flex items-end gap-2">
								<Button variant="ghost" onClick={() => settings.data && setValues(Object.fromEntries(fields.map((f) => [f.key, String(settings.data[f.key])])))}>
									Undo
								</Button>
								<Button type="submit" variant="primary" loading={save.isPending}>
									Save settings
								</Button>
							</div>
						</>
					)}
					<div className="md:col-span-2 xl:col-span-4">
						<InlineError message={save.error?.message} />
					</div>
				</form>
			)}
		</Card>
	);
}
