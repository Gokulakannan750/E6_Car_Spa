import React, { useState, useEffect, useCallback } from 'react';
import {
	History,
	Search,
	Filter,
	RotateCw,
	Eye,
	X,
	CheckCircle2,
	XCircle,
	Calendar,
	User,
	Shield,
	Layers,
	FileText,
	Clock,
	ArrowRight,
	Globe,
	Info,
} from 'lucide-react';
import { getAuditLogs, type AuditLogDto, type AuditLogQueryParams } from '../../lib/api';

const MODULE_OPTIONS = [
	{ label: 'All Modules', value: '' },
	{ label: 'Authentication', value: 'Authentication' },
	{ label: 'Users', value: 'Users' },
	{ label: 'Invoices', value: 'Invoices' },
	{ label: 'Payments', value: 'Payments' },
	{ label: 'Showrooms', value: 'Showrooms' },
	{ label: 'Staff Advances', value: 'StaffAdvances' },
	{ label: 'Settings', value: 'Settings' },
	{ label: 'Customers', value: 'Customers' },
	{ label: 'Vehicles', value: 'Vehicles' },
	{ label: 'Job Cards', value: 'JobCards' },
];

const OUTCOME_OPTIONS = [
	{ label: 'All Outcomes', value: '' },
	{ label: 'Success', value: 'Success' },
	{ label: 'Failure', value: 'Failure' },
];

function formatActionBadge(action: string) {
	const act = action.toUpperCase();
	if (act.includes('SUCCESS') || act.includes('CREATED') || act === 'CREATE' || act.includes('CONFIRMED')) {
		return {
			bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
			dot: 'bg-emerald-500',
		};
	}
	if (act.includes('FAILED') || act.includes('DELETE') || act.includes('VOID') || act.includes('DEACTIVATED') || act.includes('OBSOLETED') || act === 'CANCEL') {
		return {
			bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
			dot: 'bg-rose-500',
		};
	}
	if (act.includes('UNLOCKED') || act.includes('GENERATE') || act.includes('SETTLED') || act.includes('PAYMENT')) {
		return {
			bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
			dot: 'bg-purple-500',
		};
	}
	return {
		bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
		dot: 'bg-amber-500',
	};
}

function formatJsonDisplay(rawJson: string | null): React.ReactNode {
	if (!rawJson) return <span className="text-zinc-400 italic text-sm">None</span>;
	try {
		const parsed = JSON.parse(rawJson);
		return (
			<pre className="bg-zinc-950 text-zinc-200 p-3 rounded-lg text-xs font-mono overflow-x-auto border border-zinc-800 leading-relaxed max-h-60 overflow-y-auto">
				{JSON.stringify(parsed, null, 2)}
			</pre>
		);
	} catch {
		return (
			<div className="bg-zinc-950 text-zinc-200 p-3 rounded-lg text-xs font-mono overflow-x-auto border border-zinc-800">
				{rawJson}
			</div>
		);
	}
}

export const AuditLogPage: React.FC = () => {
	const [logs, setLogs] = useState<AuditLogDto[]>([]);
	const [totalCount, setTotalCount] = useState<number>(0);
	const [totalPages, setTotalPages] = useState<number>(1);
	const [page, setPage] = useState<number>(1);
	const [pageSize, setPageSize] = useState<number>(25);

	const [search, setSearch] = useState<string>('');
	const [selectedModule, setSelectedModule] = useState<string>('');
	const [selectedOutcome, setSelectedOutcome] = useState<string>('');
	const [fromDate, setFromDate] = useState<string>('');
	const [toDate, setToDate] = useState<string>('');

	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	const [selectedLog, setSelectedLog] = useState<AuditLogDto | null>(null);

	const fetchLogs = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const params: AuditLogQueryParams = {
				page,
				pageSize,
				search: search.trim() || undefined,
				module: selectedModule || undefined,
				outcome: selectedOutcome || undefined,
				fromDate: fromDate || undefined,
				toDate: toDate || undefined,
			};
			const res = await getAuditLogs(params);
			setLogs(res.items);
			setTotalCount(res.totalCount);
			setTotalPages(res.totalPages || Math.ceil(res.totalCount / pageSize) || 1);
		} catch (err: unknown) {
			console.error('Failed to load audit logs:', err);
			setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
		} finally {
			setIsLoading(false);
		}
	}, [page, pageSize, search, selectedModule, selectedOutcome, fromDate, toDate]);

	useEffect(() => {
		fetchLogs();
	}, [fetchLogs]);

	const handleSearchSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setPage(1);
		fetchLogs();
	};

	const handleClearFilters = () => {
		setSearch('');
		setSelectedModule('');
		setSelectedOutcome('');
		setFromDate('');
		setToDate('');
		setPage(1);
	};

	const formatTimestamp = (utcStr: string) => {
		try {
			const d = new Date(utcStr);
			return {
				date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
				time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
			};
		} catch {
			return { date: utcStr, time: '' };
		}
	};

	return (
		<div className="space-y-6 pb-12">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
				<div>
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
							<History className="w-6 h-6" />
						</div>
						<div>
							<h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
								Audit Trail & Activity History
							</h1>
							<p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
								Immutable, append-only security and operational activity log.
							</p>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<button
						onClick={() => fetchLogs()}
						disabled={isLoading}
						className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors shadow-sm disabled:opacity-50"
					>
						<RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
						Refresh
					</button>
				</div>
			</div>

			{/* Filters Bar */}
			<div className="bg-white dark:bg-zinc-900/70 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
				<form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
					{/* Search */}
					<div className="lg:col-span-2 relative">
						<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
						<input
							type="text"
							placeholder="Search user, action, module, reference..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
						/>
					</div>

					{/* Module Filter */}
					<div>
						<select
							value={selectedModule}
							onChange={(e) => {
								setSelectedModule(e.target.value);
								setPage(1);
							}}
							className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
						>
							{MODULE_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>

					{/* Outcome Filter */}
					<div>
						<select
							value={selectedOutcome}
							onChange={(e) => {
								setSelectedOutcome(e.target.value);
								setPage(1);
							}}
							className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
						>
							{OUTCOME_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>

					{/* From Date */}
					<div>
						<input
							type="date"
							value={fromDate}
							onChange={(e) => {
								setFromDate(e.target.value);
								setPage(1);
							}}
							className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
						/>
					</div>

					{/* To Date */}
					<div>
						<input
							type="date"
							value={toDate}
							onChange={(e) => {
								setToDate(e.target.value);
								setPage(1);
							}}
							className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
						/>
					</div>
				</form>

				{(search || selectedModule || selectedOutcome || fromDate || toDate) && (
					<div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
						<span>Active filters applied</span>
						<button
							onClick={handleClearFilters}
							className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
						>
							Clear all filters
						</button>
					</div>
				)}
			</div>

			{/* Logs Table */}
			<div className="bg-white dark:bg-zinc-900/70 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
				{isLoading ? (
					<div className="py-24 text-center">
						<RotateCw className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-3" />
						<p className="text-sm text-zinc-500 dark:text-zinc-400">Loading audit records...</p>
					</div>
				) : error ? (
					<div className="py-16 text-center text-rose-500">
						<XCircle className="w-8 h-8 mx-auto mb-2" />
						<p className="font-semibold">{error}</p>
					</div>
				) : logs.length === 0 ? (
					<div className="py-20 text-center text-zinc-500 dark:text-zinc-400">
						<Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
						<p className="text-base font-medium">No audit records found</p>
						<p className="text-xs text-zinc-400 mt-1">Try adjusting your filters or search terms.</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm">
							<thead className="bg-zinc-50/75 dark:bg-zinc-950/50 text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
								<tr>
									<th className="py-3.5 px-4">Timestamp (UTC / Local)</th>
									<th className="py-3.5 px-4">User</th>
									<th className="py-3.5 px-4">Module & Action</th>
									<th className="py-3.5 px-4">Target Entity</th>
									<th className="py-3.5 px-4">Description</th>
									<th className="py-3.5 px-4 text-center">Outcome</th>
									<th className="py-3.5 px-4 text-right">Details</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-sans">
								{logs.map((log) => {
									const ts = formatTimestamp(log.timestampUtc);
									const badge = formatActionBadge(log.action);
									const isSuccess = log.outcome?.toLowerCase() === 'success';

									return (
										<tr
											key={log.id}
											className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors group cursor-pointer"
											onClick={() => setSelectedLog(log)}
										>
											{/* Timestamp */}
											<td className="py-3.5 px-4 whitespace-nowrap">
												<div className="font-medium text-zinc-900 dark:text-zinc-100">
													{ts.date}
												</div>
												<div className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">
													{ts.time}
												</div>
											</td>

											{/* User */}
											<td className="py-3.5 px-4 whitespace-nowrap">
												{log.userName ? (
													<div>
														<div className="font-medium text-zinc-900 dark:text-zinc-100">
															{log.userName}
														</div>
														{log.userRole && (
															<span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
																{log.userRole}
															</span>
														)}
													</div>
												) : (
													<span className="text-zinc-400 italic text-xs">Anonymous / System</span>
												)}
											</td>

											{/* Module & Action */}
											<td className="py-3.5 px-4 whitespace-nowrap">
												<div className="flex items-center gap-2 mb-1">
													<span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
														{log.module}
													</span>
												</div>
												<span
													className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${badge.bg}`}
												>
													<span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
													{log.action}
												</span>
											</td>

											{/* Target Entity */}
											<td className="py-3.5 px-4 whitespace-nowrap">
												{log.entityReference ? (
													<div className="font-medium text-zinc-900 dark:text-zinc-200">
														{log.entityReference}
													</div>
												) : (
													<span className="text-zinc-400">—</span>
												)}
												{log.entityType && (
													<div className="text-xs text-zinc-400">{log.entityType}</div>
												)}
											</td>

											{/* Description */}
											<td className="py-3.5 px-4 max-w-xs truncate text-zinc-600 dark:text-zinc-300" title={log.description}>
												{log.description}
											</td>

											{/* Outcome */}
											<td className="py-3.5 px-4 whitespace-nowrap text-center">
												{isSuccess ? (
													<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
														<CheckCircle2 className="w-3.5 h-3.5" />
														Success
													</span>
												) : (
													<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
														<XCircle className="w-3.5 h-3.5" />
														Failure
													</span>
												)}
											</td>

											{/* Action Button */}
											<td className="py-3.5 px-4 text-right whitespace-nowrap">
												<button
													onClick={(e) => {
														e.stopPropagation();
														setSelectedLog(log);
													}}
													className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
													title="View Details"
												>
													<Eye className="w-4 h-4" />
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}

				{/* Pagination Footer */}
				{!isLoading && logs.length > 0 && (
					<div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 gap-3 bg-zinc-50/50 dark:bg-zinc-950/30 text-xs text-zinc-500">
						<div className="flex items-center gap-2">
							<span>
								Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of{' '}
								<span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalCount}</span> logs
							</span>
							<span className="text-zinc-300 dark:text-zinc-700">|</span>
							<span>Page size:</span>
							<select
								value={pageSize}
								onChange={(e) => {
									setPageSize(Number(e.target.value));
									setPage(1);
								}}
								className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100"
							>
								<option value={10}>10</option>
								<option value={25}>25</option>
								<option value={50}>50</option>
								<option value={100}>100</option>
							</select>
						</div>

						<div className="flex items-center gap-1.5">
							<button
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page <= 1}
								className="px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
							>
								Previous
							</button>
							<span className="px-2 font-medium text-zinc-900 dark:text-zinc-100">
								{page} / {totalPages}
							</span>
							<button
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								disabled={page >= totalPages}
								className="px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
							>
								Next
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Read-Only Detail Modal */}
			{selectedLog && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
						{/* Modal Header */}
						<div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/40">
							<div className="flex items-center gap-3">
								<div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
									<History className="w-5 h-5" />
								</div>
								<div>
									<h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
										Audit Event Details
									</h2>
									<p className="text-xs text-zinc-500 font-mono">ID: {selectedLog.id}</p>
								</div>
							</div>

							<button
								onClick={() => setSelectedLog(null)}
								className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						{/* Modal Content */}
						<div className="p-6 space-y-6 overflow-y-auto flex-1 text-sm">
							{/* Overview Grid */}
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80">
								<div>
									<span className="text-xs text-zinc-400 font-medium block">Timestamp</span>
									<span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
										{new Date(selectedLog.timestampUtc).toLocaleString('en-IN')}
									</span>
								</div>

								<div>
									<span className="text-xs text-zinc-400 font-medium block">Module</span>
									<span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
										{selectedLog.module}
									</span>
								</div>

								<div>
									<span className="text-xs text-zinc-400 font-medium block">Action</span>
									<span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
										{selectedLog.action}
									</span>
								</div>

								<div>
									<span className="text-xs text-zinc-400 font-medium block">Outcome</span>
									<span
										className={`inline-flex items-center gap-1 text-xs font-semibold ${
											selectedLog.outcome?.toLowerCase() === 'success'
												? 'text-emerald-500'
												: 'text-rose-500'
										}`}
									>
										{selectedLog.outcome?.toLowerCase() === 'success' ? (
											<CheckCircle2 className="w-3.5 h-3.5" />
										) : (
											<XCircle className="w-3.5 h-3.5" />
										)}
										{selectedLog.outcome}
									</span>
								</div>

								<div>
									<span className="text-xs text-zinc-400 font-medium block">User (Actor)</span>
									<span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
										{selectedLog.userName || 'Anonymous / System'}
									</span>
								</div>

								<div>
									<span className="text-xs text-zinc-400 font-medium block">Role Snapshot</span>
									<span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
										{selectedLog.userRole || '—'}
									</span>
								</div>

								<div>
									<span className="text-xs text-zinc-400 font-medium block">Entity Type</span>
									<span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
										{selectedLog.entityType || '—'}
									</span>
								</div>

								<div>
									<span className="text-xs text-zinc-400 font-medium block">Entity Reference</span>
									<span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate block" title={selectedLog.entityReference || ''}>
										{selectedLog.entityReference || '—'}
									</span>
								</div>
							</div>

							{/* Description */}
							<div>
								<h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
									Event Description
								</h3>
								<div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200">
									{selectedLog.description}
								</div>
							</div>

							{/* Before & After State Comparison */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
										<span>Previous State (Old Values)</span>
									</h3>
									{formatJsonDisplay(selectedLog.oldValues)}
								</div>

								<div>
									<h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
										<span>New State (New Values)</span>
									</h3>
									{formatJsonDisplay(selectedLog.newValues)}
								</div>
							</div>

							{/* Metadata */}
							{selectedLog.metadata && (
								<div>
									<h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
										Additional Metadata
									</h3>
									{formatJsonDisplay(selectedLog.metadata)}
								</div>
							)}
						</div>

						{/* Modal Footer */}
						<div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-center justify-between">
							<div className="text-xs text-zinc-400 flex items-center gap-1.5">
								<Shield className="w-3.5 h-3.5 text-zinc-500" />
								<span>Immutable System Record — Cannot be modified or deleted.</span>
							</div>
							<button
								onClick={() => setSelectedLog(null)}
								className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-colors"
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
