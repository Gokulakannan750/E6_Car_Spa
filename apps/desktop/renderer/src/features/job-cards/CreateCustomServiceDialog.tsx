import { useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { CATALOGUE_CATEGORIES } from '../../constants/catalogue';
import { capitalizeSentence } from '../../utils/text';
import { createService, type ServiceDto } from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';

export interface CreateCustomServiceDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onServiceCreated: (service: ServiceDto) => void;
	title?: string;
	descriptionText?: string;
	submitLabel?: string;
}

export function CreateCustomServiceDialog({
	open,
	onOpenChange,
	onServiceCreated,
	title = 'Create Custom Service',
	descriptionText = 'Create a new service in the catalogue and add it to this job card',
	submitLabel = 'Create Service',
}: CreateCustomServiceDialogProps) {
	const queryClient = useQueryClient();
	const [name, setName] = useState('');
	const [category, setCategory] = useState<string>(CATALOGUE_CATEGORIES[0]);
	const [description, setDescription] = useState('');
	const [price, setPrice] = useState('');
	const [isActive, setIsActive] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const resetForm = () => {
		setName('');
		setCategory(CATALOGUE_CATEGORIES[0]);
		setDescription('');
		setPrice('');
		setIsActive(true);
		setError(null);
	};

	const handleClose = () => {
		onOpenChange(false);
		resetForm();
	};

	const handleSubmit = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (!name.trim()) {
			setError('Service name is required.');
			return;
		}
		const parsedPrice = parseFloat(price);
		if (!price.trim() || isNaN(parsedPrice) || parsedPrice < 0) {
			setError('Please enter a valid price (0 or greater).');
			return;
		}

		setIsSubmitting(true);
		setError(null);
		try {
			const created = await createService({
				name: capitalizeSentence(name.trim()),
				category: category || CATALOGUE_CATEGORIES[0],
				price: parsedPrice,
				taxPercentage: 18,
				description: description.trim() ? capitalizeSentence(description.trim()) : undefined,
				isActive,
			});

			await queryClient.invalidateQueries({ queryKey: ['services'] });
			onServiceCreated(created);
			handleClose();
		} catch (err: unknown) {
			console.error('Failed to create custom service:', err);
			const msg =
				err instanceof Error && !err.message.startsWith('HTTP ')
					? err.message
					: 'Failed to create service. Please try again.';
			setError(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(isOpen) => {
				if (!isOpen) handleClose();
				else onOpenChange(true);
			}}
			title={title}
			description={descriptionText}
			size="md"
			footer={
				<>
					<Button type="button" variant="secondary" onClick={handleClose}>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={() => handleSubmit()}
						disabled={isSubmitting || !name.trim() || !price.trim()}
						loading={isSubmitting}
					>
						{submitLabel}
					</Button>
				</>
			}
		>
			<form onSubmit={handleSubmit} className="space-y-4 py-1">
				{error && (
					<div className="flex items-center gap-2 p-3 rounded-lg bg-error-container/40 border border-error/30 text-error text-xs">
						<AlertCircle className="w-4 h-4 shrink-0" />
						<span>{error}</span>
					</div>
				)}

				<div>
					<label className="block text-sm font-medium text-on-surface mb-1">
						Service Name <span className="text-error">*</span>
					</label>
					<input
						required
						value={name}
						onChange={(e) => setName(e.target.value)}
						onBlur={() => setName((n) => capitalizeSentence(n))}
						className="form-input w-full"
						placeholder="e.g. Custom Scratch Removal"
						autoFocus
					/>
				</div>

				<div>
					<label className="block text-sm font-medium text-on-surface mb-1">Category</label>
					<select
						value={category}
						onChange={(e) => setCategory(e.target.value)}
						className="form-input w-full"
					>
						{CATALOGUE_CATEGORIES.map((cat) => (
							<option key={cat} value={cat}>
								{cat}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className="block text-sm font-medium text-on-surface mb-1">Description</label>
					<textarea
						rows={2}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						onBlur={() => setDescription((d) => (d.trim() ? capitalizeSentence(d) : ''))}
						className="form-input w-full resize-none"
						placeholder="Service details, warranty, or scope of work (optional)..."
					/>
				</div>

				<div>
					<label className="block text-sm font-medium text-on-surface mb-1">
						Price (₹) <span className="text-error">*</span>
					</label>
					<input
						required
						type="number"
						step="0.01"
						min="0"
						value={price}
						onChange={(e) => setPrice(e.target.value)}
						className="form-input w-full"
						placeholder="0.00"
					/>
				</div>

				<div className="flex items-center gap-2 pt-1">
					<input
						type="checkbox"
						id="custom-svc-active"
						checked={isActive}
						onChange={(e) => setIsActive(e.target.checked)}
						className="w-4 h-4 accent-secondary rounded cursor-pointer"
					/>
					<label htmlFor="custom-svc-active" className="text-xs font-medium text-on-surface cursor-pointer select-none">
						Active — available in catalogue and job card selection
					</label>
				</div>
			</form>
		</Dialog>
	);
}
