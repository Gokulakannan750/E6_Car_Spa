import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function CustomerDetailPage() {
	const navigate = useNavigate();

	return (
		<div className="space-y-6 animate-fade-in">
			<div>
				<button
					type="button"
					onClick={() => navigate('/customers')}
					className="inline-flex items-center text-xs font-semibold text-on-surface-variant hover:text-secondary mb-2 transition-colors cursor-pointer"
				>
					<ArrowLeft className="w-3.5 h-3.5 mr-1" />
					Back to Customers
				</button>
				<h1 className="text-2xl font-bold text-on-surface tracking-tight">Customer Details</h1>
				<p className="text-sm text-on-surface-variant mt-1">Customer profile and vehicle history</p>
			</div>
		</div>
	);
}