import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Phone, Car, Calendar, ArrowUpRight, RefreshCw, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../stores/app';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import {
	getCustomers,
	getVehiclesByCustomer,
	getJobCardsByCustomer,
	getJobCardStatusLabel,
	type CustomerDto,
	type VehicleDto,
	type JobCardListDto,
} from '../../lib/api';

export function CustomersPage() {
	const navigate = useNavigate();
	const globalSearch = useAppStore((s) => s.globalSearch);
	const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

	// Fetch real customers from API
	const {
		data: customersData,
		isLoading: isLoadingCustomers,
		isError: isCustomersError,
		error: customersError,
		refetch: refetchCustomers,
	} = useQuery({
		queryKey: ['customers', globalSearch],
		queryFn: () => getCustomers({ page: 1, pageSize: 100, search: globalSearch.trim() || undefined }),
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
			</div>

			{/* Filters & Search Info Bar */}
			<div className="app-card p-4">
				<div className="flex items-center justify-between gap-3">
					<div className="flex-1 max-w-md">
						{globalSearch ? (
							<div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
								<span className="text-sm text-blue-700 truncate">
									Searching: <strong>"{globalSearch}"</strong>
								</span>
							</div>
						) : (
							<span className="text-sm text-on-surface-variant">Real PostgreSQL customer records</span>
						)}
					</div>
					<div className="text-sm text-on-surface-variant">
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
							{globalSearch
								? `No customer records matching "${globalSearch}".`
								: 'Customers are automatically registered when creating a job card.'}
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="app-table">
							<thead>
								<tr>
									<th>Customer</th>
									<th>Phone</th>
									<th>Email</th>
									<th>Address</th>
									<th>Created Date</th>
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
										<td className="text-sm text-on-surface-variant truncate max-w-[200px]">
											{c.address || '—'}
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
							<h3 className="text-lg font-semibold text-on-surface mb-3">
								Vehicles ({customerVehicles.length})
							</h3>
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
														{v.make} {v.model} {v.color ? '· ' + v.color : ''}
													</p>
												</div>
											</div>
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
		</div>
	);
}
