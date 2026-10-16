import { useProducts, ChooseProduct } from '@/features/products/ProductProvider';
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/Button';
import { TextareaField, TextField } from '@/components/Field';
import { ReasonDialog } from '@/components/ReasonDialog';
import { Card, CardHeader } from '@/components/Surface';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

export function PublicListingCard() {
	const { product } = useProducts();
	const toast = useToast();
	const queryClient = useQueryClient();

	const [tagline, setTagline] = useState('');
	const [description, setDescription] = useState('');
	const [learnMoreUrl, setLearnMoreUrl] = useState('');
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [reasonOpen, setReasonOpen] = useState(false);

	useEffect(() => {
		if (product) {
			setTagline(product.publicTagline ?? '');
			setDescription(product.publicDescription ?? '');
			setLearnMoreUrl(product.learnMoreUrl ?? '');
			setErrors({});
			setReasonOpen(false);
		}
	}, [product?.key, product?.publicTagline, product?.publicDescription, product?.learnMoreUrl]);

	const save = useMutation({
		mutationFn: (reason: string) =>
			api.updateProductPublicListing(product!.key, {
				publicTagline: tagline.trim() || null,
				publicDescription: description.trim() || null,
				learnMoreUrl: learnMoreUrl.trim() || null,
				reason,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['products'] });
			setReasonOpen(false);
			toast.success(`Public listing updated · ${product?.name}`);
		},
	});

	if (!product) return <ChooseProduct />;

	const changed =
		tagline.trim() !== (product.publicTagline ?? '').trim() ||
		description.trim() !== (product.publicDescription ?? '').trim() ||
		learnMoreUrl.trim() !== (product.learnMoreUrl ?? '').trim();

	function handleSaveClick(event: FormEvent) {
		event.preventDefault();
		const next: Record<string, string> = {};

		if (tagline.length > 140) {
			next.tagline = 'Tagline cannot exceed 140 characters.';
		}
		if (description.length > 400) {
			next.description = 'Description cannot exceed 400 characters.';
		}
		if (learnMoreUrl.trim()) {
			const trimmedUrl = learnMoreUrl.trim();
			if (trimmedUrl.length > 300) {
				next.learnMoreUrl = 'Learn more URL cannot exceed 300 characters.';
			} else {
				try {
					const parsed = new URL(trimmedUrl);
					if (parsed.protocol !== 'https:') {
						next.learnMoreUrl = 'Learn more URL must use https://';
					}
				} catch {
					next.learnMoreUrl = 'Enter a valid URL starting with https://';
				}
			}
		}

		setErrors(next);
		if (Object.keys(next).length === 0) {
			setReasonOpen(true);
		}
	}

	function handleUndo() {
		setTagline(product?.publicTagline ?? '');
		setDescription(product?.publicDescription ?? '');
		setLearnMoreUrl(product?.learnMoreUrl ?? '');
		setErrors({});
		setReasonOpen(false);
	}

	return (
		<>
			<Card className="mb-6">
				<CardHeader
					title={`Public listing · ${product.name}`}
					subtitle="Tagline, overview description, and learn-more link displayed on the public sign-up chooser."
				/>
				<form onSubmit={handleSaveClick} noValidate className="space-y-4 p-5">
					<TextField
						label="Public tagline"
						value={tagline}
						onChange={(e) => setTagline(e.target.value)}
						error={errors.tagline}
						hint="Max 140 characters. Displayed directly under the product title on chooser cards."
						maxLength={140}
					/>
					<TextareaField
						label="Public description"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						error={errors.description}
						hint="Max 400 characters. Explains who the product is for and key capabilities."
						maxLength={400}
						rows={3}
					/>
					<TextField
						label="Learn more URL"
						type="url"
						value={learnMoreUrl}
						onChange={(e) => setLearnMoreUrl(e.target.value)}
						error={errors.learnMoreUrl}
						hint="Optional https:// URL (max 300 characters) pointing to marketing or product tour pages."
						maxLength={300}
						placeholder="https://trovotechsolutions.in/products/..."
					/>
					{changed && (
						<div className="flex items-center justify-end gap-2 pt-2">
							<Button variant="ghost" type="button" onClick={handleUndo}>
								Undo
							</Button>
							<Button type="submit" variant="primary">
								Save changes
							</Button>
						</div>
					)}
				</form>
			</Card>

			<ReasonDialog
				open={reasonOpen}
				title={`Update public listing · ${product.name}`}
				description="Explain why you are changing the public listing fields. This will be recorded in the audit log."
				confirmLabel="Save changes"
				busy={save.isPending}
				error={save.error instanceof Error ? save.error.message : null}
				onConfirm={(reason) => save.mutate(reason)}
				onClose={() => setReasonOpen(false)}
			/>
		</>
	);
}
