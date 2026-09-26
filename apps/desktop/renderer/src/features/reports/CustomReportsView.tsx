import { useState } from 'react';
import {
	SlidersHorizontal,
	Download,
	CheckSquare,
	Square,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import type { DashboardSummaryDto } from '../../lib/api';
import * as XLSX from 'xlsx';

interface CustomReportsViewProps {
	data: DashboardSummaryDto | undefined;
	isLoading: boolean;
	bounds: { start: Date; end: Date; startStr: string; endStr: string; label: string };
	formatINR: (val?: number | null) => string;
}

export function CustomReportsView({ data, isLoading, bounds, formatINR }: CustomReportsViewProps) {
	const [includeSales, setIncludeSales] = useState(true);
	const [includePayments, setIncludePayments] = useState(true);
	const [includeServices, setIncludeServices] = useState(true);
	const [includeAdvances, setIncludeAdvances] = useState(true);
	const [includeShowrooms, setIncludeShowrooms] = useState(true);

	const handleExportCustomExcel = () => {
		if (!data) return;

		const wb = XLSX.utils.book_new();

		if (includeSales) {
			const salesData = [
				['Sales Metric', 'Value (INR)'],
				['Gross Subtotal', data.sales?.grossSubtotal ?? 0],
				['Total Discount', data.sales?.totalDiscount ?? 0],
				['GST Amount', data.sales?.gstAmount ?? 0],
				['Net Billed Sales', data.sales?.netSales ?? 0],
			];
			const ws = XLSX.utils.aoa_to_sheet(salesData);
			XLSX.utils.book_append_sheet(wb, ws, 'Sales Analysis');
		}

		if (includePayments) {
			const payData = [
				['Payment Method', 'Transaction Count', 'Total Amount (INR)'],
				...(data.paymentCollection?.breakdownByMethod || []).map((m) => [m.method, m.transactionCount, m.amount]),
			];
			const ws = XLSX.utils.aoa_to_sheet(payData);
			XLSX.utils.book_append_sheet(wb, ws, 'Payment Collections');
		}

		if (includeServices) {
			const svcData = [
				['Service Name', 'Category', 'Bookings', 'Revenue (INR)'],
				...(data.topServices || []).map((s) => [s.name, s.category || 'General', s.count, s.revenue]),
			];
			const ws = XLSX.utils.aoa_to_sheet(svcData);
			XLSX.utils.book_append_sheet(wb, ws, 'Top Services');
		}

		if (includeAdvances) {
			const advData = [
				['Date', 'Staff Name', 'Role', 'Amount (INR)', 'Reason', 'Status'],
				...(data.recentAdvances || []).map((a) => [
					a.advanceDate.split('T')[0],
					a.staffName,
					a.staffRole || 'Staff',
					a.amount,
					a.reason || '',
					a.status,
				]),
			];
			const ws = XLSX.utils.aoa_to_sheet(advData);
			XLSX.utils.book_append_sheet(wb, ws, 'Staff Advances');
		}

		if (includeShowrooms) {
			const srData = [
				['Showroom Metric', 'Value'],
				['Active Showrooms Count', data.showroom?.activeShowroomsCount ?? 0],
				['Total Showroom Billed', data.showroom?.totalBilled ?? 0],
				['Total Showroom Received', data.showroom?.totalReceived ?? 0],
				['Total Showroom Outstanding', data.showroom?.totalOutstanding ?? 0],
				['Vehicles Attended', data.showroom?.vehiclesAttended ?? 0],
			];
			const ws = XLSX.utils.aoa_to_sheet(srData);
			XLSX.utils.book_append_sheet(wb, ws, 'Showroom Operations');
		}

		XLSX.writeFile(wb, `E6_Custom_Report_${bounds.startStr}_to_${bounds.endStr}.xlsx`);
	};

	return (
		<div className="space-y-6 animate-fade-in" data-testid="custom-reports-view">
			{/* ── Custom Filter & Dimension Builder ─────────────────────────── */}
			<div className="app-card p-5 space-y-4">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant pb-4">
					<div>
						<h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
							<SlidersHorizontal className="w-4 h-4 text-secondary" />
							Custom Report Builder &amp; Exporter
						</h2>
						<p className="text-xs text-on-surface-variant mt-0.5">
							Select financial and operational dimensions to generate a tailored report export
						</p>
					</div>

					<Button
						variant="primary"
						size="sm"
						icon={<Download className="w-4 h-4" />}
						onClick={handleExportCustomExcel}
						disabled={isLoading || !data}
					>
						Export Tailored Excel
					</Button>
				</div>

				{/* Dimension Checkboxes */}
				<div className="space-y-2">
					<span className="text-xs font-semibold text-on-surface uppercase tracking-wider">
						Include Report Modules:
					</span>
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-1">
						<button
							type="button"
							onClick={() => setIncludeSales((v) => !v)}
							className={`flex items-center gap-2 p-3 rounded-lg text-xs font-medium border transition-all text-left ${
								includeSales
									? 'bg-secondary/10 border-secondary text-secondary'
									: 'bg-surface-container border-outline-variant text-on-surface-variant'
							}`}
						>
							{includeSales ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
							<span>Sales &amp; Revenue</span>
						</button>

						<button
							type="button"
							onClick={() => setIncludePayments((v) => !v)}
							className={`flex items-center gap-2 p-3 rounded-lg text-xs font-medium border transition-all text-left ${
								includePayments
									? 'bg-secondary/10 border-secondary text-secondary'
									: 'bg-surface-container border-outline-variant text-on-surface-variant'
							}`}
						>
							{includePayments ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
							<span>Collections &amp; Methods</span>
						</button>

						<button
							type="button"
							onClick={() => setIncludeServices((v) => !v)}
							className={`flex items-center gap-2 p-3 rounded-lg text-xs font-medium border transition-all text-left ${
								includeServices
									? 'bg-secondary/10 border-secondary text-secondary'
									: 'bg-surface-container border-outline-variant text-on-surface-variant'
							}`}
						>
							{includeServices ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
							<span>Top Services</span>
						</button>

						<button
							type="button"
							onClick={() => setIncludeAdvances((v) => !v)}
							className={`flex items-center gap-2 p-3 rounded-lg text-xs font-medium border transition-all text-left ${
								includeAdvances
									? 'bg-secondary/10 border-secondary text-secondary'
									: 'bg-surface-container border-outline-variant text-on-surface-variant'
							}`}
						>
							{includeAdvances ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
							<span>Staff Advances</span>
						</button>

						<button
							type="button"
							onClick={() => setIncludeShowrooms((v) => !v)}
							className={`flex items-center gap-2 p-3 rounded-lg text-xs font-medium border transition-all text-left ${
								includeShowrooms
									? 'bg-secondary/10 border-secondary text-secondary'
									: 'bg-surface-container border-outline-variant text-on-surface-variant'
							}`}
						>
							{includeShowrooms ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
							<span>Showroom Metrics</span>
						</button>
					</div>
				</div>
			</div>

			{/* ── Active Dimensions Preview ─────────────────────────────────── */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{includeSales && (
					<div className="app-card p-4 space-y-2">
						<span className="text-xs font-bold text-on-surface">Sales Summary Preview</span>
						<div className="text-xs space-y-1.5 text-on-surface-variant pt-1">
							<div className="flex justify-between">
								<span>Gross Subtotal:</span>
								<span className="font-mono font-medium text-on-surface">{formatINR(data?.sales?.grossSubtotal)}</span>
							</div>
							<div className="flex justify-between">
								<span>Net Sales:</span>
								<span className="font-mono font-bold text-secondary">{formatINR(data?.sales?.netSales)}</span>
							</div>
						</div>
					</div>
				)}

				{includePayments && (
					<div className="app-card p-4 space-y-2">
						<span className="text-xs font-bold text-on-surface">Collections Preview</span>
						<div className="text-xs space-y-1.5 text-on-surface-variant pt-1">
							<div className="flex justify-between">
								<span>Total Received:</span>
								<span className="font-mono font-bold text-success">{formatINR(data?.paymentCollection?.totalReceived)}</span>
							</div>
							<div className="flex justify-between">
								<span>Transactions:</span>
								<span className="font-mono font-medium text-on-surface">{data?.paymentCollection?.transactionCount ?? 0}</span>
							</div>
						</div>
					</div>
				)}

				{includeShowrooms && (
					<div className="app-card p-4 space-y-2">
						<span className="text-xs font-bold text-on-surface">Showrooms Preview</span>
						<div className="text-xs space-y-1.5 text-on-surface-variant pt-1">
							<div className="flex justify-between">
								<span>Showroom Billed:</span>
								<span className="font-mono font-medium text-on-surface">{formatINR(data?.showroom?.totalBilled)}</span>
							</div>
							<div className="flex justify-between">
								<span>Showroom Outstanding:</span>
								<span className="font-mono font-bold text-error">{formatINR(data?.showroom?.totalOutstanding)}</span>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
