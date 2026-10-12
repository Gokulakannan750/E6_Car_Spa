import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useBreadcrumbs } from '@/app/layout/Breadcrumbs';
import { Button } from '@/components/Button';
import { SelectField } from '@/components/Field';
import { Modal } from '@/components/Modal';
import { Card, DetailList, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/Surface';
import { api } from '@/lib/api';
import { actionLabel, AUDIT_ACTIONS, prettyJson } from '@/lib/audit';
import { dateTime } from '@/lib/format';
import type { AuditEntry } from '@/lib/types';

const PAGE_SIZE = 50;

export function AuditLogPage() {
	useBreadcrumbs({ label: 'Audit Log' });
	const [params, setParams] = useSearchParams();
	const companyId = params.get('company') ?? '';
	const action = params.get('action') ?? '';
	const page = Math.max(1, Number(params.get('page')) || 1);
	const [selected, setSelected] = useState<AuditEntry | null>(null);

	const companies = useQuery({ queryKey: ['companies', '', ''], queryFn: () => api.companies() });
	const log = useQuery({
		queryKey: ['audit', companyId, page],
		queryFn: () => api.auditLogs(companyId || undefined, page),
		placeholderData: keepPreviousData,
	});
	const companyById = useMemo(() => new Map((companies.data ?? []).map((c) => [c.id, c])), [companies.data]);
	// The API pages by company; the action filter narrows the page shown.
	const rows = useMemo(() => (log.data ?? []).filter((e) => !action || e.action === action), [log.data, action]);

	function setParam(key: string, value: string) {
		const next = new URLSearchParams(params);
		if (!value) next.delete(key);
		else next.set(key, value);
		if (key !== 'page') next.delete('page');
		setParams(next, { replace: true });
	}

	return (
		<>
			<PageHeader title="Audit log" description="Every change made by Trovo staff and the system: who, what, when, why and from where. Entries cannot be edited or deleted." />
			<Card>
				<div className="flex flex-wrap items-end gap-3 border-b border-border-subtle p-4">
					<SelectField label="Company" value={companyId} onChange={(e) => setParam('company', e.target.value)} containerClassName="w-72">
						<option value="">All companies and platform changes</option>
						{(companies.data ?? []).map((c) => (
							<option key={c.id} value={c.id}>
								{c.code} · {c.name}
							</option>
						))}
					</SelectField>
					<SelectField label="Action" value={action} onChange={(e) => setParam('action', e.target.value)} containerClassName="w-64">
						<option value="">All actions</option>
						{AUDIT_ACTIONS.map((a) => (
							<option key={a} value={a}>
								{actionLabel(a)}
							</option>
						))}
					</SelectField>
				</div>
				{log.isPending ? (
					<LoadingState />
				) : log.isError ? (
					<ErrorState error={log.error} onRetry={() => log.refetch()} />
				) : rows.length === 0 ? (
					<EmptyState title="No entries" description={action ? 'No entries with this action on this page.' : undefined} />
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-table">
							<thead>
								<tr className="border-b border-border-subtle text-left text-label font-semibold tracking-[0.04em] whitespace-nowrap text-text-muted uppercase">
									<th className="h-10 px-4">When</th>
									<th className="h-10 px-4">Who</th>
									<th className="h-10 px-4">Action</th>
									<th className="h-10 px-4">Company</th>
									<th className="h-10 px-4">Reason</th>
									<th className="h-10 px-4">IP address</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((e) => {
									const company = e.targetCompanyId ? companyById.get(e.targetCompanyId) : undefined;
									return (
										<tr
											key={e.id}
											tabIndex={0}
											onClick={() => setSelected(e)}
											onKeyDown={(k) => k.key === 'Enter' && setSelected(e)}
											className="h-11 cursor-pointer border-b border-border-hairline last:border-b-0 hover:bg-surface-raised/60"
										>
											<td className="tabular px-4 py-2 whitespace-nowrap text-text-secondary">{dateTime(e.createdAt)}</td>
											<td className="px-4 py-2">{e.administratorEmail ?? <span className="text-text-muted">System</span>}</td>
											<td className="px-4 py-2 font-medium text-text-heading">{actionLabel(e.action)}</td>
											<td className="px-4 py-2">
												{company ? (
													<span>
														<span className="tabular mr-1.5 font-mono text-text-muted">{company.code}</span>
														{company.name}
													</span>
												) : (
													<span className="text-text-muted">—</span>
												)}
											</td>
											<td className="max-w-80 truncate px-4 py-2 text-text-secondary">{e.reason ?? '—'}</td>
											<td className="tabular px-4 py-2 font-mono text-micro text-text-muted">{e.ipAddress ?? '—'}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
				<div className="flex items-center justify-between border-t border-border-subtle px-4 py-3 text-label text-text-muted">
					<span>Page {page}</span>
					<div className="flex gap-2">
						<Button size="sm" icon={<ChevronLeft className="size-3.5" />} disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>
							Newer
						</Button>
						<Button size="sm" disabled={(log.data?.length ?? 0) < PAGE_SIZE} onClick={() => setParam('page', String(page + 1))}>
							Older <ChevronRight className="size-3.5" />
						</Button>
					</div>
				</div>
			</Card>
			<EntryDialog entry={selected} companyName={selected?.targetCompanyId ? companyById.get(selected.targetCompanyId) : undefined} onClose={() => setSelected(null)} />
		</>
	);
}

function EntryDialog({ entry, companyName, onClose }: { entry: AuditEntry | null; companyName?: { id: string; code: string; name: string }; onClose: () => void }) {
	return (
		<Modal open={entry !== null} onClose={onClose} width="lg" title={entry ? actionLabel(entry.action) : ''} description={entry ? dateTime(entry.createdAt) : undefined}>
			{entry && (
				<div className="flex flex-col gap-5">
					<DetailList
						items={[
							{ label: 'Who', value: entry.administratorEmail ?? 'System' },
							{
								label: 'Company',
								value: companyName ? (
									<Link to={`/companies/${companyName.id}`} className="text-action hover:text-action-hover" onClick={onClose}>
										{companyName.code} · {companyName.name}
									</Link>
								) : (
									'—'
								),
							},
							{ label: 'Reason', value: entry.reason ?? '—' },
							{ label: 'IP address', value: <span className="font-mono">{entry.ipAddress ?? '—'}</span> },
							{ label: 'Action code', value: <span className="font-mono text-label">{entry.action}</span> },
						]}
					/>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<JsonBlock title="Before" value={entry.beforeValues} />
						<JsonBlock title="After" value={entry.afterValues} />
					</div>
				</div>
			)}
		</Modal>
	);
}

function JsonBlock({ title, value }: { title: string; value: string | null }) {
	return (
		<div>
			<div className="mb-1 text-micro font-medium tracking-wide text-text-muted uppercase">{title}</div>
			<pre className="max-h-80 min-h-16 overflow-auto rounded-md border border-border-subtle bg-surface-alt p-3 font-mono text-micro whitespace-pre-wrap text-text-secondary">
				{value ? prettyJson(value) : '—'}
			</pre>
		</div>
	);
}
