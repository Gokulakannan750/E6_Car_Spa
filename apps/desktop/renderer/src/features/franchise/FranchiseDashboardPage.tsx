import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../components/PageHeader';
import { ChartCard } from '../../components/charts/ChartCard';
import { formatCurrency } from '../../lib/format';
import {
	getFranchiseBillingReport,
	getFranchiseDashboard,
	type FranchiseeFinancialsDto,
	type FranchiseFinancialTotalsDto,
} from '../../lib/api';
import { generateAndDownloadMonthlyBillingReport } from '../reports/excelMonthlyBillingGenerator';
import { downloadCompanyTotals, downloadNetworkSummary } from './excelFranchiseGenerator';

function isoDate(date: Date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function daysAgo(days: number) {
	const d = new Date();
	d.setDate(d.getDate() - days);
	return isoDate(d);
}

const PRESETS = [
	{ label: 'Last 7 days', days: 6 },
	{ label: 'Last 30 days', days: 29 },
	{ label: 'Last 90 days', days: 89 },
] as const;

function Kpi({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
			<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
			<p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
		</div>
	);
}

function Totals({ totals }: { totals: FranchiseFinancialTotalsDto }) {
	return (
		<div className="grid grid-cols-2 gap-4 md:grid-cols-5">
			<Kpi label="Invoiced" value={formatCurrency(totals.invoicedAmount)} />
			<Kpi label="Collected" value={formatCurrency(totals.collectedAmount)} />
			<Kpi label="Outstanding" value={formatCurrency(totals.outstandingAmount)} />
			<Kpi label="Invoices" value={String(totals.invoiceCount)} />
			<Kpi label="Job cards" value={String(totals.jobCardCount)} />
		</div>
	);
}

function currentMonth() {
	return isoDate(new Date()).slice(0, 7);
}

export function FranchiseDashboardPage() {
	const [from, setFrom] = useState(daysAgo(29));
	const [to, setTo] = useState(daysAgo(0));
	const [month, setMonth] = useState(currentMonth());
	const [exporting, setExporting] = useState<string | null>(null);
	const [exportError, setExportError] = useState<string | null>(null);

	const runExport = async (key: string, action: () => Promise<unknown>) => {
		setExportError(null);
		setExporting(key);
		try {
			await action();
		} catch (err) {
			setExportError(err instanceof Error ? err.message : 'The Excel file could not be created.');
		} finally {
			setExporting(null);
		}
	};

	const exportCompany = (f: FranchiseeFinancialsDto, dashboardFrom: string, dashboardTo: string) => {
		if (f.allowedItems.includes('invoice_list')) {
			const [year, monthNumber] = month.split('-').map(Number);
			return runExport(f.linkId, async () => {
				const report = await getFranchiseBillingReport(f.linkId, year, monthNumber);
				await generateAndDownloadMonthlyBillingReport(report, f.partnerName);
			});
		}
		return runExport(f.linkId, () => downloadCompanyTotals(f, dashboardFrom, dashboardTo));
	};
	const validPeriod = from !== '' && to !== '' && from <= to;

	const dashboard = useQuery({
		queryKey: ['franchise-dashboard', from, to],
		queryFn: () => getFranchiseDashboard(from, to),
		enabled: validPeriod,
	});

	const data = dashboard.data;
	const chartData = useMemo(
		() => (data?.network.daily ?? []).map((d) => ({ date: d.date.slice(5), Invoiced: d.invoiced, Collected: d.collected })),
		[data],
	);
	const sharing = (data?.franchisees ?? []).filter((f) => f.financialTotalsAllowed);
	const notSharing = (data?.franchisees ?? []).filter((f) => !f.financialTotalsAllowed);

	return (
		<div className="space-y-6 max-w-6xl mx-auto">
			<PageHeader
				title="Franchise Dashboard"
				description="The financial figures your franchisees have allowed you to see. Nothing else is shown."
			/>

			<div className="flex flex-wrap items-end gap-3">
				<div className="flex gap-2" role="group" aria-label="Period">
					{PRESETS.map((p) => (
						<button
							key={p.label}
							type="button"
							className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
							onClick={() => {
								setFrom(daysAgo(p.days));
								setTo(daysAgo(0));
							}}
						>
							{p.label}
						</button>
					))}
				</div>
				<label className="text-xs font-medium text-slate-600">
					From
					<input
						type="date"
						value={from}
						max={to}
						onChange={(e) => setFrom(e.target.value)}
						className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm"
					/>
				</label>
				<label className="text-xs font-medium text-slate-600">
					To
					<input
						type="date"
						value={to}
						min={from}
						onChange={(e) => setTo(e.target.value)}
						className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm"
					/>
				</label>
			</div>

			{!validPeriod && <p className="text-sm text-red-600">The start date must not be after the end date.</p>}
			{exportError && (
				<p role="alert" className="text-sm text-red-600">
					{exportError}
				</p>
			)}
			{dashboard.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
			{dashboard.isError && (
				<p className="text-sm text-red-600">
					{dashboard.error instanceof Error ? dashboard.error.message : 'Could not load the franchise figures.'}
				</p>
			)}

			{data && data.franchisees.length === 0 && (
				<div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
					No franchisee is connected yet. Invite a company from the{' '}
					<Link to="/franchise" className="font-semibold text-teal-700 underline">
						Franchise Network
					</Link>{' '}
					page; once they accept and allow the financial totals, their figures appear here.
				</div>
			)}

			{data && sharing.length > 0 && (
				<>
					<section aria-label="Network totals" className="space-y-3">
						<h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
							Network total ({sharing.length} {sharing.length === 1 ? 'company' : 'companies'})
						</h2>
						<Totals totals={data.network} />
						<button
							type="button"
							disabled={exporting === 'network'}
							onClick={() => runExport('network', () => downloadNetworkSummary(data))}
							className="rounded-md border border-teal-600 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
						>
							{exporting === 'network' ? 'Preparing…' : 'Download network summary (Excel)'}
						</button>
					</section>

					<ChartCard title="Invoiced and collected" subtitle={`${data.from} to ${data.to}, all companies together`}>
						{chartData.length === 0 ? (
							<p className="flex h-[240px] items-center justify-center text-sm text-slate-500">No invoices or payments in this period.</p>
						) : (
							<ResponsiveContainer width="100%" height={260}>
								<BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="date" tick={{ fontSize: 12 }} />
									<YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} />
									<Tooltip formatter={(v: number) => formatCurrency(v)} />
									<Legend />
									<Bar dataKey="Invoiced" fill="#0D9488" radius={[4, 4, 0, 0]} />
									<Bar dataKey="Collected" fill="#2563EB" radius={[4, 4, 0, 0]} />
								</BarChart>
							</ResponsiveContainer>
						)}
					</ChartCard>

					<section aria-label="By company" className="space-y-3">
						<div className="flex flex-wrap items-end justify-between gap-3">
							<h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">By company</h2>
							<label className="text-xs font-medium text-slate-600">
								Billing report month
								<input
									type="month"
									value={month}
									max={currentMonth()}
									onChange={(e) => e.target.value && setMonth(e.target.value)}
									className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm"
								/>
							</label>
						</div>
						<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
							<table className="w-full text-sm">
								<thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
									<tr>
										<th className="px-4 py-2">Company</th>
										<th className="px-4 py-2 text-right">Invoiced</th>
										<th className="px-4 py-2 text-right">Collected</th>
										<th className="px-4 py-2 text-right">Outstanding</th>
										<th className="px-4 py-2 text-right">Invoices</th>
										<th className="px-4 py-2 text-right">Job cards</th>
										<th className="px-4 py-2 text-right">Excel</th>
									</tr>
								</thead>
								<tbody>
									{sharing.map((f) => (
										<tr key={f.linkId} className="border-t border-slate-100">
											<td className="px-4 py-2">
												<span className="font-semibold text-slate-900">{f.partnerName}</span>
												<span className="ml-2 text-xs text-slate-500">{f.partnerCodeHint}</span>
											</td>
											<td className="px-4 py-2 text-right">{formatCurrency(f.totals!.invoicedAmount)}</td>
											<td className="px-4 py-2 text-right">{formatCurrency(f.totals!.collectedAmount)}</td>
											<td className="px-4 py-2 text-right">{formatCurrency(f.totals!.outstandingAmount)}</td>
											<td className="px-4 py-2 text-right">{f.totals!.invoiceCount}</td>
											<td className="px-4 py-2 text-right">{f.totals!.jobCardCount}</td>
											<td className="px-4 py-2 text-right">
												<button
													type="button"
													disabled={exporting === f.linkId}
													onClick={() => exportCompany(f, data.from, data.to)}
													className="whitespace-nowrap rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
													title={
														f.allowedItems.includes('invoice_list')
															? 'The full monthly billing report, with a sheet for every day'
															: 'Totals and daily totals. Ask for the invoice list to get the full billing report.'
													}
												>
													{exporting === f.linkId
														? 'Preparing…'
														: f.allowedItems.includes('invoice_list')
															? 'Billing report'
															: 'Totals'}
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</>
			)}

			{notSharing.length > 0 && (
				<section aria-label="Not shared" className="space-y-2">
					<h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Not shared with you</h2>
					<ul className="space-y-1 text-sm text-slate-600">
						{notSharing.map((f) => (
							<li key={f.linkId}>
								<span className="font-semibold text-slate-800">{f.partnerName}</span> has not allowed the financial totals. You can ask
								again from the{' '}
								<Link to="/franchise" className="font-semibold text-teal-700 underline">
									Franchise Network
								</Link>{' '}
								page.
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	);
}

export default FranchiseDashboardPage;
