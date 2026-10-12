import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Database, Play, XCircle } from 'lucide-react';
import { useBreadcrumbs } from '@/app/layout/Breadcrumbs';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Card, CardHeader, EmptyState, ErrorState, InlineError, LoadingState, PageHeader } from '@/components/Surface';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';

export function SystemPage() {
	useBreadcrumbs({ label: 'System' });
	const toast = useToast();
	const queryClient = useQueryClient();
	const [confirming, setConfirming] = useState(false);
	const status = useQuery({ queryKey: ['migrations'], queryFn: api.migrations });
	const run = useMutation({
		mutationFn: api.runMigrations,
		onSuccess: (result) => {
			queryClient.setQueryData(['migrations'], result);
			queryClient.invalidateQueries({ queryKey: ['companies'] });
			queryClient.invalidateQueries({ queryKey: ['dashboard'] });
			const failed = result.filter((r) => r.migrationError).length;
			if (failed > 0) toast.error(`${failed} of ${result.length} company databases failed to update.`);
			else toast.success(`All ${result.length} company databases are up to date.`);
			setConfirming(false);
		},
	});

	const rows = status.data ?? [];
	const failed = rows.filter((r) => r.migrationError).length;
	const versions = new Set(rows.map((r) => r.schemaVersion).filter(Boolean));

	return (
		<>
			<PageHeader
				title="System"
				description="Each company has its own database. The API updates them when it starts; run the update here after a failure."
				actions={
					<Button variant="primary" icon={<Play className="size-4" />} onClick={() => setConfirming(true)}>
						Update all databases
					</Button>
				}
			/>
			<div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
				<Stat label="Company databases" value={rows.length} />
				<Stat label="Schema versions in use" value={versions.size} note={versions.size > 1 ? 'Some databases are behind' : undefined} />
				<Stat label="Failed updates" value={failed} danger={failed > 0} />
			</div>
			<Card>
				<CardHeader title="Company databases" />
				{status.isPending ? (
					<LoadingState />
				) : status.isError ? (
					<ErrorState error={status.error} onRetry={() => status.refetch()} />
				) : rows.length === 0 ? (
					<EmptyState title="No company databases yet" />
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-table">
							<thead>
								<tr className="border-b border-border-subtle text-left text-label font-semibold tracking-[0.04em] whitespace-nowrap text-text-muted uppercase">
									<th className="h-10 px-4">Company</th>
									<th className="h-10 px-4">Schema version</th>
									<th className="h-10 px-4">Last updated</th>
									<th className="h-10 px-4">Result</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((r) => (
									<tr key={r.code} className="border-b border-border-hairline align-top last:border-b-0">
										<td className="px-4 py-3">
											<span className="tabular mr-2 font-mono text-text-muted">{r.code}</span>
											<span className="text-text-heading">{r.name}</span>
										</td>
										<td className="px-4 py-3 font-mono text-micro text-text-secondary">{r.schemaVersion ?? '—'}</td>
										<td className="tabular px-4 py-3 whitespace-nowrap text-text-secondary">{dateTime(r.lastMigratedAt)}</td>
										<td className="px-4 py-3">
											{r.migrationError ? (
												<div className="flex items-start gap-2 text-danger">
													<XCircle className="mt-0.5 size-4 shrink-0" />
													<span className="text-label break-words">{r.migrationError}</span>
												</div>
											) : (
												<span className="flex items-center gap-2 text-active">
													<CheckCircle2 className="size-4" /> Up to date
												</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Card>

			<Modal
				open={confirming}
				onClose={() => !run.isPending && setConfirming(false)}
				dismissable={!run.isPending}
				width="sm"
				title={
					<span className="flex items-center gap-2">
						<Database className="size-5 text-action" /> Update all company databases?
					</span>
				}
				footer={
					<>
						<Button variant="ghost" disabled={run.isPending} onClick={() => setConfirming(false)}>
							Cancel
						</Button>
						<Button variant="primary" loading={run.isPending} onClick={() => run.mutate()}>
							Update now
						</Button>
					</>
				}
			>
				<p className="text-body text-text-secondary">
					Applies any pending database changes to every company, one after another. Companies already up to date are not changed. This can take a few minutes with
					many companies.
				</p>
				<div className="mt-3">
					<InlineError message={run.error?.message} />
				</div>
			</Modal>
		</>
	);
}

function Stat({ label, value, note, danger }: { label: string; value: number; note?: string; danger?: boolean }) {
	return (
		<Card className="p-5">
			<div className="text-label font-semibold tracking-[0.04em] text-text-muted uppercase">{label}</div>
			<div className={`tabular mt-2 text-display font-bold ${danger ? 'text-danger' : 'text-text-heading'}`}>{value}</div>
			{note && <div className="mt-1 text-label text-pastdue">{note}</div>}
		</Card>
	);
}
