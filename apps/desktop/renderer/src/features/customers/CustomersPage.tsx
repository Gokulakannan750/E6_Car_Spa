import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Phone, Calendar, RefreshCw, AlertCircle, Search, Edit3, Car } from 'lucide-react';
import { useAppStore } from '../../stores/app';
import { Button } from '../../components/ui/Button';
import { CreateCustomerModal } from './CreateCustomerModal';
import { EditCustomerModal } from './EditCustomerModal';
import {
	getCustomers,
	getVehiclesByCustomer,
	type CustomerDto,
} from '../../lib/api';

function CustomerVehiclesCell({ customerId, initialVehicles }: { customerId: string; initialVehicles?: string[] }) {
	const { data: vehicles } = useQuery({
		queryKey: ['vehicles-by-customer', customerId],
		queryFn: () => getVehiclesByCustomer(customerId),
		enabled: !initialVehicles || initialVehicles.length === 0,
		staleTime: 60_000,
	});

	const regNumbers =
		initialVehicles && initialVehicles.length > 0
			? initialVehicles
			: vehicles?.map((v) => v.registrationNumber) || [];

	if (regNumbers.length === 0) {
		return <span className="text-sm text-on-surface-variant">—</span>;
	}

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			{regNumbers.map((reg) => (
				<span
					key={reg}
					className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium bg-surface-container text-on-surface rounded border border-outline-variant/60"
				>
					<Car className="w-3.5 h-3.5 text-secondary shrink-0" />
					<span>{reg}</span>
				</span>
			))}
		</div>
	);
}

export function CustomersPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const globalSearch = useAppStore((s) => s.globalSearch);
	const [localSearch, setLocalSearch] = useState('');
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [editingCustomer, setEditingCustomer] = useState<CustomerDto | null>(null);

	const activeSearch = (localSearch || globalSearch).trim();

	// Fetch real customers from API
	const {
		data: customersData,
		isLoading: isLoadingCustomers,
		isError: isCustomersError,
		error: customersError,
		refetch: refetchCustomers,
	} = useQuery({
		queryKey: ['customers', activeSearch],
		queryFn: () => getCustomers({ page: 1, pageSize: 100, search: activeSearch || undefined }),
	});

	const customers: CustomerDto[] = customersData?.items ?? [];
	const totalCount = customersData?.totalCount ?? customers.length;

	return (
		<div className="space-y-5 animate-fade-in">
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-on-surface tracking-tight">Customers</h1>
					<p className="text-sm text-on-surface-variant mt-1">Directory of all registered car spa customers</p>
				</div>
				<Button
					icon={<Plus className="w-4 h-4" />}
					onClick={() => setIsCreateModalOpen(true)}
				>
					Create Customer
				</Button>
			</div>

			{/* Search & Stats Bar */}
			<div className="app-card p-4 space-y-3">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div className="flex items-center gap-2 flex-1 max-w-md">
						<div className="relative flex-1">
							<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
							<input
								type="text"
								value={localSearch}
								onChange={(e) => setLocalSearch(e.target.value)}
								placeholder="Search customers by name, phone, or vehicle registration..."
								className="form-input pl-9 pr-3 py-1.5 w-full text-sm"
							/>
						</div>
					</div>

					{/* Global Search Indicator */}
					{globalSearch && (
						<div className="flex items-center gap-2 bg-secondary/10 border border-secondary/20 rounded-lg px-3 py-1.5">
							<span className="text-sm text-secondary truncate">
								Global: <strong>"{globalSearch}"</strong>
							</span>
						</div>
					)}

					<div className="ml-auto text-sm text-on-surface-variant">
						{totalCount} customer{totalCount !== 1 ? 's' : ''}
					</div>
				</div>
			</div>

			{/* Customers Table / List */}
			<div className="app-card overflow-hidden">
				{isLoadingCustomers ? (
					<div className="p-8 text-center text-on-surface-variant">
						<RefreshCw className="w-6 h-6 animate-spin mx-auto text-secondary mb-2" />
						<p className="text-sm">Loading customers...</p>
					</div>
				) : isCustomersError ? (
					<div className="p-8 text-center text-error">
						<AlertCircle className="w-6 h-6 mx-auto mb-2 text-error" />
						<p className="text-sm font-medium">
							{customersError instanceof Error ? customersError.message : 'Failed to load customers'}
						</p>
						<Button
							variant="secondary"
							size="sm"
							className="mt-3"
							onClick={() => refetchCustomers()}
						>
							Retry
						</Button>
					</div>
				) : customers.length === 0 ? (
					<div className="p-12 text-center text-on-surface-variant">
						<p className="text-base font-medium text-on-surface">No customers found</p>
						<p className="text-sm text-on-surface-variant mt-1">
							{activeSearch ? 'Try a different search term.' : 'Get started by creating your first customer.'}
						</p>
						{!activeSearch && (
							<Button
								icon={<Plus className="w-4 h-4" />}
								className="mt-4"
								onClick={() => setIsCreateModalOpen(true)}
							>
								Create Customer
							</Button>
						)}
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="app-table">
							<thead>
								<tr>
									<th>Customer</th>
									<th>Phone</th>
									<th>Vehicles</th>
									<th>Registered On</th>
									<th className="text-right">Actions</th>
								</tr>
							</thead>
							<tbody>
								{customers.map((c) => (
									<tr
										key={c.id}
										className="cursor-pointer"
										onClick={() => navigate(`/customers/${c.id}`)}
									>
										<td>
											<div className="flex items-center gap-3">
												<div className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xs font-semibold shrink-0">
													{c.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'CU'}
												</div>
												<div>
													<p className="font-medium text-on-surface">{c.name}</p>
													{c.email && (
														<p className="text-xs text-on-surface-variant">{c.email}</p>
													)}
												</div>
											</div>
										</td>
										<td className="font-mono text-on-surface-variant">
											<div className="flex items-center gap-1.5 text-sm">
												<Phone className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
												<span>{c.phoneNumber}</span>
											</div>
										</td>
										<td>
											<CustomerVehiclesCell
												customerId={c.id}
												initialVehicles={c.vehicleRegistrationNumbers}
											/>
										</td>
										<td className="text-on-surface-variant whitespace-nowrap">
											<div className="flex items-center gap-1.5 text-sm">
												<Calendar className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
												<span>
													{new Date(c.createdAt).toLocaleDateString('en-IN', {
														day: 'numeric',
														month: 'short',
														year: 'numeric',
													})}
												</span>
											</div>
										</td>
										<td className="text-right" onClick={(e) => e.stopPropagation()}>
											<button
												type="button"
												title="Edit Customer"
												className="p-1.5 text-on-surface-variant hover:text-secondary rounded-lg hover:bg-secondary/10 transition-colors cursor-pointer inline-flex items-center justify-center"
												onClick={() => setEditingCustomer(c)}
											>
												<Edit3 className="w-4 h-4" />
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Create Customer Dialog */}
			<CreateCustomerModal
				open={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
				onSuccess={(newCustomer) => {
					setIsCreateModalOpen(false);
					queryClient.invalidateQueries({ queryKey: ['customers'] });
					queryClient.invalidateQueries({ queryKey: ['vehicles-by-customer'] });
					queryClient.invalidateQueries({ queryKey: ['vehicles'] });
					navigate(`/customers/${newCustomer.id}`);
				}}
			/>

			{/* Edit Customer Dialog */}
			<EditCustomerModal
				open={!!editingCustomer}
				customer={editingCustomer}
				onClose={() => setEditingCustomer(null)}
				onSuccess={() => {
					setEditingCustomer(null);
					queryClient.invalidateQueries({ queryKey: ['customers'] });
					queryClient.invalidateQueries({ queryKey: ['vehicles-by-customer'] });
					queryClient.invalidateQueries({ queryKey: ['vehicles'] });
					refetchCustomers();
				}}
			/>
		</div>
	);
}
