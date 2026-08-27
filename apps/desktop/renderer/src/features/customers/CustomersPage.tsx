import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Phone, Car, Calendar, RefreshCw, AlertCircle, UserPlus, Search, Edit3 } from 'lucide-react';
import { useAppStore } from '../../stores/app';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { CreateCustomerModal } from './CreateCustomerModal';
import { EditCustomerModal } from './EditCustomerModal';
import {
	getCustomers,
	getVehiclesByCustomer,
	getJobCardsByCustomer,
	getJobCardStatusLabel,
	type CustomerDto,
	type VehicleDto,
	type JobCardListDto,
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
		<div className="flex flex-wrap items-center gap-1.5 max-w-[260px]">
			{regNumbers.map((reg, idx) => (
				<span
					key={idx}
					className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-container-high text-on-surface border border-outline-variant/60 uppercase"
				>
					<Car className="w-3 h-3 text-secondary shrink-0" />
					{reg}
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
	const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
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
	const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;

	// Fetch real customer vehicles when selected
	const { data: customerVehiclesData, isLoading: isLoadingVehicles } = useQuery({
		queryKey: ['vehicles-by-customer', selectedCustomerId],
		queryFn: () => getVehiclesByCustomer(selectedCustomerId!),
		enabled: !!selectedCustomerId,
	});
	const customerVehicles: VehicleDto[] = customerVehiclesData ?? [];

	// Fetch real customer job cards when selected
	const {
		data: customerJobCardsData,
		isLoading: isLoadingJobCards,
		error: jobCardsError,
	} = useQuery({
		queryKey: ['job-cards-by-customer', selectedCustomerId],
		queryFn: () => getJobCardsByCustomer(selectedCustomerId!),
		enabled: !!selectedCustomerId,
	});
	const customerJobCards: JobCardListDto[] = customerJobCardsData?.items ?? [];

	const footerButtons = (
		<>
			<Button variant="secondary" onClick={() => setSelectedCustomerId(null)}>
				Close
			</Button>
			<Button
				variant="secondary"
				icon={<Edit3 className="w-4 h-4" />}
				onClick={() => {
					if (selectedCustomer) {
						setEditingCustomer(selectedCustomer);
					}
				}}
			>
				Edit Details
			</Button>
			<Button
				icon={<Plus className="w-4 h-4" />}
				onClick={() => {
					setSelectedCustomerId(null);
					navigate('/job-cards/new');
				}}
			>
				New Job Card
			</Button>
		</>
	);

	return (
		<div className="space-y-5 animate-fade-in">
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-on-surface tracking-tight">Customers</h1>
					<p className="text-sm text-on-surface-variant mt-1">View customer directory and service histories</p>
				</div>
				<Button
					icon={<UserPlus className="w-4 h-4" />}
					onClick={() => setIsCreateModalOpen(true)}
				>
					Create Customer
				</Button>
			</div>

			{/* Search & Filter Bar */}
			<div className="app-card p-4">
				<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
					<div className="relative flex-1 max-w-md">
						<Search className="w-4 h-4 text-on-surface-variant/60 absolute left-3 top-1/2 -translate-y-1/2" />
						<input
							type="text"
							value={localSearch}
							onChange={(e) => setLocalSearch(e.target.value)}
							placeholder="Search customers by name, phone, vehicle no, email..."
							className="form-input w-full pl-9 pr-3 py-1.5 text-sm"
						/>
					</div>
					<div className="text-sm font-medium text-on-surface-variant bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/50 self-start sm:self-auto">
						{customers.length} customer{customers.length !== 1 ? 's' : ''}
					</div>
				</div>
			</div>

			{/* Customer Table / Empty State / Error State */}
			<div className="app-card overflow-hidden">
				{isLoadingCustomers ? (
					<div className="py-16 text-center text-on-surface-variant">
						<RefreshCw className="w-6 h-6 animate-spin mx-auto text-secondary mb-2" />
						<p className="text-sm font-medium">Loading customers...</p>
					</div>
				) : isCustomersError ? (
					<div className="py-12 text-center text-error space-y-3">
						<AlertCircle className="w-8 h-8 mx-auto text-error" />
						<p className="text-sm font-medium">
							{(customersError as Error)?.message || 'Failed to load customers from backend.'}
						</p>
						<Button variant="secondary" onClick={() => refetchCustomers()}>
							Retry
						</Button>
					</div>
				) : customers.length === 0 ? (
					<div className="py-16 text-center">
						<div className="w-12 h-12 rounded-full bg-secondary/10 text-secondary flex items-center justify-center mx-auto mb-3">
							<Car className="w-6 h-6" />
						</div>
						<h3 className="text-base font-semibold text-on-surface">No customers found</h3>
						<p className="text-sm text-on-surface-variant mt-1 max-w-sm mx-auto">
							{activeSearch
								? `No customer records matching "${activeSearch}".`
								: 'No customer profiles have been added yet. Click below to add your first customer.'}
						</p>
						<div className="mt-4">
							<Button
								icon={<UserPlus className="w-4 h-4" />}
								onClick={() => setIsCreateModalOpen(true)}
							>
								Create Customer
							</Button>
						</div>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="app-table">
							<thead>
								<tr>
									<th>Customer</th>
									<th>Phone</th>
									<th>Email</th>
									<th>Car Registration No.</th>
									<th>Created Date</th>
									<th className="text-right">Action</th>
								</tr>
							</thead>
							<tbody>
								{customers.map((c) => (
									<tr
										key={c.id}
										className="cursor-pointer hover:bg-surface-container/50 transition-colors"
										onClick={() => setSelectedCustomerId(c.id)}
									>
										<td>
											<div className="flex items-center gap-3">
												<div className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xs font-semibold">
													{c.name
														.split(' ')
														.map((n) => n[0])
														.join('')
														.slice(0, 2)
														.toUpperCase()}
												</div>
												<div>
													<p className="font-medium text-on-surface">{c.name}</p>
												</div>
											</div>
										</td>
										<td>
											<span className="font-mono text-sm">{c.phoneNumber}</span>
										</td>
										<td className="text-sm text-on-surface-variant">{c.email || '—'}</td>
										<td>
											<CustomerVehiclesCell customerId={c.id} initialVehicles={c.vehicleRegistrationNumbers} />
										</td>
										<td className="text-sm text-on-surface-variant">
											<div className="flex items-center gap-1">
												<Calendar className="w-3.5 h-3.5" />
												{new Date(c.createdAt).toLocaleDateString('en-IN', {
													day: 'numeric',
													month: 'short',
													year: 'numeric',
												})}
											</div>
										</td>
										<td className="text-right" onClick={(e) => e.stopPropagation()}>
											<button
												type="button"
												onClick={() => setEditingCustomer(c)}
												className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md text-on-surface-variant hover:text-secondary hover:bg-secondary/10 transition-colors cursor-pointer"
												title="Edit Customer"
											>
												<Edit3 className="w-3.5 h-3.5" />
												<span>Edit</span>
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Customer Detail Dialog */}
			<Dialog
				open={!!selectedCustomerId}
				onOpenChange={(open) => !open && setSelectedCustomerId(null)}
				title={selectedCustomer?.name || 'Customer Details'}
				description="Customer details, vehicles, and recent job cards"
				size="lg"
				footer={footerButtons}
			>
				{selectedCustomer && (
					<div className="space-y-5">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="text-sm text-on-surface-variant mb-1">Phone</p>
								<p className="font-medium text-on-surface flex items-center gap-1.5">
									<Phone className="w-4 h-4 text-secondary" />
									{selectedCustomer.phoneNumber}
								</p>
							</div>
							<div>
								<p className="text-sm text-on-surface-variant mb-1">Email</p>
								<p className="font-medium text-on-surface">{selectedCustomer.email || '—'}</p>
							</div>
							<div className="col-span-2">
								<p className="text-sm text-on-surface-variant mb-1">Address</p>
								<p className="text-sm text-on-surface">{selectedCustomer.address || '—'}</p>
							</div>
						</div>

						<div>
							<div className="flex items-center justify-between mb-3">
								<h3 className="text-lg font-semibold text-on-surface">
									Vehicles ({customerVehicles.length})
								</h3>
								<Button
									variant="secondary"
									size="sm"
									icon={<Edit3 className="w-3.5 h-3.5" />}
									onClick={() => {
										if (selectedCustomer) setEditingCustomer(selectedCustomer);
									}}
								>
									Edit Vehicles
								</Button>
							</div>
							{isLoadingVehicles ? (
								<div className="py-4 text-center text-on-surface-variant">
									<RefreshCw className="w-4 h-4 animate-spin mx-auto text-secondary mb-1" />
									<p className="text-xs">Loading vehicles...</p>
								</div>
							) : customerVehicles.length > 0 ? (
								<div className="space-y-2">
									{customerVehicles.map((v) => (
										<div
											key={v.id}
											className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant"
										>
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-md bg-secondary/10 flex items-center justify-center">
													<Car className="w-4 h-4 text-secondary" />
												</div>
												<div>
													<p className="font-medium text-on-surface font-mono">{v.registrationNumber}</p>
													<p className="text-sm text-on-surface-variant">
														{v.make} {v.model} {v.variant ? `(${v.variant})` : ''}
													</p>
												</div>
											</div>
											<button
												type="button"
												onClick={() => {
													if (selectedCustomer) setEditingCustomer(selectedCustomer);
												}}
												className="p-1.5 text-on-surface-variant hover:text-secondary rounded hover:bg-secondary/10 transition-colors"
												title="Edit vehicle details"
											>
												<Edit3 className="w-4 h-4" />
											</button>
										</div>
									))}
								</div>
							) : (
								<p className="text-sm text-on-surface-variant py-3">No vehicles registered yet.</p>
							)}
						</div>

						<div>
							<h3 className="text-lg font-semibold text-on-surface mb-3">Recent Activity</h3>
							{isLoadingJobCards ? (
								<div className="py-4 text-center text-on-surface-variant">
									<RefreshCw className="w-5 h-5 animate-spin mx-auto text-secondary mb-1" />
									<p className="text-xs">Loading job cards...</p>
								</div>
							) : jobCardsError ? (
								<p className="text-sm text-error py-2">Unable to load job cards.</p>
							) : customerJobCards.length > 0 ? (
								<div className="space-y-2">
									{customerJobCards.slice(0, 5).map((jc) => (
										<div
											key={jc.id}
											className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant cursor-pointer hover:bg-surface-container transition-colors"
											onClick={() => {
												setSelectedCustomerId(null);
												navigate(`/job-cards/${jc.id}`);
											}}
										>
											<div>
												<p className="font-medium text-secondary font-mono">{jc.jobCardNumber}</p>
												<p className="text-sm text-on-surface-variant">
													{new Date(jc.createdAt).toLocaleDateString('en-IN', {
														day: 'numeric',
														month: 'short',
														year: 'numeric',
													})}
													{jc.registrationNumber ? ` · ${jc.registrationNumber}` : ''}
												</p>
											</div>
											<div className="text-right">
												<p className="text-sm font-medium text-on-surface">
													₹{jc.totalAmount.toLocaleString('en-IN')}
												</p>
												<span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">
													{getJobCardStatusLabel(jc.status)}
												</span>
											</div>
										</div>
									))}
								</div>
							) : (
								<p className="text-sm text-on-surface-variant py-3">No job cards yet.</p>
							)}
						</div>
					</div>
				)}
			</Dialog>

			{/* Create Customer Dialog */}
			<CreateCustomerModal
				open={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
				onSuccess={(newCustomer) => {
					setIsCreateModalOpen(false);
					queryClient.invalidateQueries({ queryKey: ['customers'] });
					queryClient.invalidateQueries({ queryKey: ['vehicles-by-customer'] });
					queryClient.invalidateQueries({ queryKey: ['vehicles'] });
					setSelectedCustomerId(newCustomer.id);
				}}
			/>

			{/* Edit Customer Dialog */}
			<EditCustomerModal
				open={!!editingCustomer}
				customer={editingCustomer}
				onClose={() => setEditingCustomer(null)}
				onSuccess={(updated) => {
					setEditingCustomer(null);
					queryClient.invalidateQueries({ queryKey: ['customers'] });
					queryClient.invalidateQueries({ queryKey: ['vehicles-by-customer'] });
					queryClient.invalidateQueries({ queryKey: ['vehicles'] });
					if (selectedCustomerId === updated.id) {
						refetchCustomers();
					}
				}}
			/>
		</div>
	);
}
