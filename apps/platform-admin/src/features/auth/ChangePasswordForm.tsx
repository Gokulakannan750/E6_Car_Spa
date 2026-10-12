import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Field';
import { InlineError } from '@/components/Surface';
import { api, ApiError } from '@/lib/api';
import type { SessionResponse } from '@/lib/types';
import { useState } from 'react';

// Same rules as the API (PlatformAdminService.ChangePasswordAsync): at least 12 characters and different from the current one.
export const passwordSchema = z
	.object({
		currentPassword: z.string().min(1, 'Enter your current password.'),
		newPassword: z.string().min(12, 'Use at least 12 characters.').max(200, 'That password is too long.'),
		confirmPassword: z.string().min(1, 'Type the new password again.'),
	})
	.refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'The passwords do not match.' })
	.refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a password different from the current one.' });

type Values = z.infer<typeof passwordSchema>;

export function ChangePasswordForm({ onChanged, submitLabel = 'Change password' }: { onChanged: (s: SessionResponse) => void; submitLabel?: string }) {
	const [error, setError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<Values>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });

	const submit = handleSubmit(async (values) => {
		setError(null);
		try {
			const session = await api.changePassword(values.currentPassword, values.newPassword, values.confirmPassword);
			reset();
			onChanged(session);
		} catch (e) {
			setError(e instanceof ApiError ? (e.status === 429 ? 'Too many attempts. Wait a minute and try again.' : e.message) : 'Could not change the password.');
		}
	});

	return (
		<form onSubmit={submit} className="flex flex-col gap-4" noValidate>
			<TextField label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
			<TextField
				label="New password"
				type="password"
				autoComplete="new-password"
				hint="At least 12 characters. A short sentence is easy to remember."
				error={errors.newPassword?.message}
				{...register('newPassword')}
			/>
			<TextField label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
			<InlineError message={error} />
			<Button type="submit" variant="primary" loading={isSubmitting} className="h-10 w-full">
				{submitLabel}
			</Button>
		</form>
	);
}
