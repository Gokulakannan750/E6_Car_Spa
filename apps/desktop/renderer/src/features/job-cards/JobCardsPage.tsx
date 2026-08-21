import { useState, useMemo } from 'react';
import { Plus, MoreHorizontal, Calendar, Car } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { getJobCards, type JobCardListDto } from '../../lib/api';

// PascalCase values match the C# JobCardStatus enum names for model binding
const STATUS_FILTERS = [
	{ value: 'all', label: 'All' },
	{ value: 'Draft', label: 'Draft' },
	{ value: 'InProgress', label: 'In Progress' },
	{ value: 'Ready', label: 'Ready' },
	{ value: 'Delivered', label: 'Delivered' },
];

function getJobCardStatusLabel(status: number): string {
	switch (status) {
		case 0: return 'draft';
		case 1: return 'in-progress';
		case 2: return 'quality-check';
		case 3: return 'ready-for-delivery';
		case 4: return 'invoiced';
		case 5: return 'paid';
		case 6: return 'delivered';
		case 7: return 'cancelled';
		default: return 'draft';
	}
}

export function JobCardsPage() {
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<string>('all');

	const { data: response, isLoading, isError, refetch } = useQuery<{ items: JobCardListDto[]; totalCount: number }>({
		queryKey: ['job-cards', { page: 1, pageSize: 50, status: statusFilter === 'all' ? undefined : statusFilter, search: search || undefined }],
		queryFn: () => getJobCards({ page: 1, pageSize: 50, status: statusFilter === 'all' ? undefined : statusFilter, search: search || undefined }),
	});

	const filtered = useMemo(() => response?.items ?? [], [response]);

	return (
		<div className="space-y-5 animate-fade-in">
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-headline-lg font-semibold text-on-surface tracking-tight">Job Cards</h1>
					<p className="text-sm text-on-surface-variant mt-1">Track and manage all service job cards</p>
				</div>
				<Link to="/job-cards/new">
					<Button icon={<Plus className="w-4 h-4" />}>New Job Card</Button>
				</Link>
			</div>

			{/* Filters */}
			<div className="app-card p-4">
				<div className="flex items-center gap-3">
					<div className="flex-1 max-w-md">
						<input
							type="text"
							placeholder="Search by job card, customer or vehicle..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary transition-colors"
						/>
					</div>
					<div className="flex items-center gap-1">
						{STATUS_FILTERS.map(s => (
							<button key={s.value} onClick={() => setStatusFilter(s.value)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === s.value ? 'bg-secondary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}>
								{s.label}
							</button>
						))}
					</div>
					<div className="ml-auto text-sm text-on-surface-variant">
						{isLoading ? 'Loading…' : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}
					</div>
				</div>
			</div>

			{/* Job Cards Table */}
			<div className="app-card overflow-hidden">
				{isError ? (
					<div className="p-8 text-center">
						<p className="text-error font-medium">Failed to load job cards</p>
						<button onClick={() => refetch()} className="mt-3 btn-primary">Retry</button>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="app-table">
							<thead>
								<tr>
									<th>Job Card</th>
									<th>Customer</th>
									<th>Vehicle</th>
									<th>Total</th>
									<th>Status</th>
									<th>Date</th>
									<th className="w-10"></th>
								</tr>
							</thead>
							<tbody>
								{filtered.map(jc => (
									<tr key={jc.id} className="cursor-pointer">
										<td>
											<Link to={`/job-cards/${jc.id}`} className="font-medium text-sm text-secondary font-medium hover:underline">
												{jc.jobCardNumber}
											</Link>
										</td>
										<td>
											<div>
												<p className="font-medium text-sm text-on-surface font-medium">{jc.customerName ?? '—'}</p>
												<p className="text-sm text-on-surface-variant">{jc.customerPhone ?? '—'}</p>
											</div>
										</td>
										<td>
											<div className="flex items-center gap-1.5 text-sm">
												<Car className="w-3.5 h-3.5 text-on-surface-variant" />
												<span className="font-mono text-xs">{jc.registrationNumber}</span>
												<span className="text-on-surface-variant">{jc.make} {jc.model}</span>
											</div>
										</td>
										<td className="font-medium text-sm text-on-surface font-medium">₹{jc.totalAmount.toLocaleString()}</td>
										<td><StatusBadge status={getJobCardStatusLabel(jc.status)} /></td>
										<td className="text-sm text-on-surface-variant">
											<div className="flex items-center gap-1">
												<Calendar className="w-3.5 h-3.5" />
												{new Date(jc.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
											</div>
										</td>
										<td>
											<Link to={`/job-cards/${jc.id}`}>
												<button className="p-1.5 rounded-md hover:bg-surface-container transition-colors">
													<MoreHorizontal className="w-4 h-4 text-on-surface-variant" />
												</button>
											</Link>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{!isLoading && !isError && filtered.length === 0 && (
					<div className="py-12 text-center">
						<p className="text-sm text-on-surface-variant">No job cards found matching your search.</p>
					</div>
				)}
			</div>
		</div>
	);
}
