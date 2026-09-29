/**
 * E6 Car Spa Management — Outside Jobs Excel Generator
 * Generates structured Excel reports for external vehicle movements and outside shop tracking:
 *  - Sheet 1: "Currently Outside" (Vehicles at outside shops with overdue highlights)
 *  - Sheet 2: "Outside Job History" (Complete movement logs with duration and costs)
 *  - Sheet 3: "Vendor Summary" (Vendor workload, completed, active, overdue, total cost)
 *  - Sheet 4: "Overview & KPIs" (Executive summary)
 */

import * as XLSX from 'xlsx';
import type { OutsideJobsReportDto } from '../../lib/api';

function formatDateTimeParts(isoString?: string | null): { dateStr: string; timeStr: string } {
	if (!isoString) return { dateStr: '—', timeStr: '—' };
	const d = new Date(isoString);
	if (isNaN(d.getTime())) return { dateStr: '—', timeStr: '—' };

	const dateStr = d.toLocaleDateString('en-IN', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	});

	const timeStr = d.toLocaleTimeString('en-IN', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: true,
	});

	return { dateStr, timeStr };
}

function formatDuration(hours?: number | null): string {
	if (hours === null || hours === undefined) return '—';
	if (hours < 1) {
		const mins = Math.round(hours * 60);
		return `${mins}m`;
	}
	const h = Math.floor(hours);
	const m = Math.round((hours - h) * 60);
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function generateOutsideJobsExcel(
	reportData: OutsideJobsReportDto,
	dateRangeLabel: string = 'All Time',
): void {
	const wb = XLSX.utils.book_new();

	// ── Sheet 1: Overview & KPIs ───────────────────────────────────────────────
	const totalOutsideJobs = (reportData.totalOutsideCount || 0) + (reportData.history?.length || 0);
	const completedJobs = reportData.history?.filter((h) => h.status === 2 || h.statusName === 'Returned').length || 0;
	const totalExternalCost = (reportData.totalActiveCost || 0) + (reportData.totalHistoricalCost || 0);

	const summaryAoa: any[][] = [
		['E6 CAR SPA — OUTSIDE JOBS & EXTERNAL MOVEMENT REPORT', ''],
		['Period / Scope', dateRangeLabel],
		['Generated At', new Date().toLocaleString('en-IN')],
		['', ''],
		['KEY PERFORMANCE INDICATORS', 'VALUE'],
		['Total Outside Movements', totalOutsideJobs],
		['Currently Outside Vehicles', reportData.totalOutsideCount || 0],
		['Overdue Outside Vehicles', reportData.totalOverdueCount || 0],
		['Completed / Returned to Showroom', completedJobs],
		['Total External Vendor Cost (₹)', totalExternalCost],
		['', ''],
		['SUMMARY BY VENDOR', ''],
	];

	if (reportData.vendorSummary && reportData.vendorSummary.length > 0) {
		summaryAoa.push(['Vendor Name', 'Total Jobs', 'Currently Outside', 'Overdue', 'Completed', 'Total Cost (₹)']);
		for (const v of reportData.vendorSummary) {
			summaryAoa.push([
				v.vendorName,
				v.totalJobs,
				v.currentlyOutside,
				v.overdueJobs,
				v.completedJobs,
				v.totalVendorCost,
			]);
		}
	} else {
		summaryAoa.push(['No vendor activity recorded in this period.', '']);
	}

	const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
	wsSummary['!cols'] = [{ wch: 36 }, { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];
	XLSX.utils.book_append_sheet(wb, wsSummary, 'Overview');

	// ── Sheet 2: Currently Outside ─────────────────────────────────────────────
	const activeHeaders = [
		'Job Card Number',
		'Customer',
		'Customer Phone',
		'Vehicle Registration',
		'Vehicle Model',
		'Outside Service',
		'Vendor',
		'Status',
		'Sent Date',
		'Sent Time',
		'Expected Return Date',
		'Expected Return Time',
		'Is Overdue?',
		'Vendor Cost (₹)',
		'Notes',
	];

	const activeRows = (reportData.currentlyOutside || []).map((job) => {
		const sent = formatDateTimeParts(job.sentAt);
		const expected = formatDateTimeParts(job.expectedReturnAt);
		return [
			job.jobCardNumber,
			job.customerName,
			job.customerPhone,
			job.vehicleRegistration,
			job.vehicleModel,
			job.serviceName,
			job.vendorName,
			job.isOverdue ? 'OVERDUE' : 'At Outside Shop',
			sent.dateStr,
			sent.timeStr,
			expected.dateStr,
			expected.timeStr,
			job.isOverdue ? 'YES' : 'NO',
			job.vendorCost ?? '—',
			job.notes || '',
		];
	});

	const wsActive = XLSX.utils.aoa_to_sheet([activeHeaders, ...activeRows]);
	wsActive['!cols'] = [
		{ wch: 18 }, // Job Card Number
		{ wch: 24 }, // Customer
		{ wch: 16 }, // Phone
		{ wch: 18 }, // Reg
		{ wch: 20 }, // Model
		{ wch: 24 }, // Service
		{ wch: 26 }, // Vendor
		{ wch: 18 }, // Status
		{ wch: 14 }, // Sent Date
		{ wch: 12 }, // Sent Time
		{ wch: 18 }, // Exp Date
		{ wch: 14 }, // Exp Time
		{ wch: 14 }, // Overdue
		{ wch: 16 }, // Cost
		{ wch: 35 }, // Notes
	];
	XLSX.utils.book_append_sheet(wb, wsActive, 'Currently Outside');

	// ── Sheet 3: Complete Outside Job History ──────────────────────────────────
	const historyHeaders = [
		'Job Card Number',
		'Customer',
		'Vehicle Registration',
		'Vehicle Model',
		'Outside Service',
		'Vendor',
		'Status',
		'Sent Date',
		'Sent Time',
		'Expected Return Date',
		'Expected Return Time',
		'Returned Date',
		'Returned Time',
		'Duration',
		'Vendor Cost (₹)',
		'Sent By',
		'Returned By',
		'Notes',
	];

	const historyRows = (reportData.history || []).map((job) => {
		const sent = formatDateTimeParts(job.sentAt);
		const expected = formatDateTimeParts(job.expectedReturnAt);
		const returned = formatDateTimeParts(job.returnedAt);
		return [
			job.jobCardNumber,
			job.customerName,
			job.vehicleRegistration,
			job.vehicleModel,
			job.serviceName,
			job.vendorName,
			job.statusName,
			sent.dateStr,
			sent.timeStr,
			expected.dateStr,
			expected.timeStr,
			returned.dateStr,
			returned.timeStr,
			formatDuration(job.durationHours),
			job.vendorCost ?? '—',
			job.sentByUserName || '—',
			job.returnedByUserName || '—',
			job.notes || '',
		];
	});

	const wsHistory = XLSX.utils.aoa_to_sheet([historyHeaders, ...historyRows]);
	wsHistory['!cols'] = [
		{ wch: 18 },
		{ wch: 24 },
		{ wch: 18 },
		{ wch: 20 },
		{ wch: 24 },
		{ wch: 26 },
		{ wch: 14 },
		{ wch: 14 },
		{ wch: 12 },
		{ wch: 18 },
		{ wch: 14 },
		{ wch: 14 },
		{ wch: 12 },
		{ wch: 14 },
		{ wch: 16 },
		{ wch: 18 },
		{ wch: 18 },
		{ wch: 35 },
	];
	XLSX.utils.book_append_sheet(wb, wsHistory, 'Outside Job History');

	// ── Sheet 4: Vendor Summary ────────────────────────────────────────────────
	const vendorHeaders = [
		'Vendor Name',
		'Total Outside Jobs',
		'Currently Outside',
		'Overdue Outside',
		'Completed / Returned',
		'Total External Cost (₹)',
	];

	const vendorRows = (reportData.vendorSummary || []).map((v) => [
		v.vendorName,
		v.totalJobs,
		v.currentlyOutside,
		v.overdueJobs,
		v.completedJobs,
		v.totalVendorCost,
	]);

	const wsVendors = XLSX.utils.aoa_to_sheet([vendorHeaders, ...vendorRows]);
	wsVendors['!cols'] = [
		{ wch: 32 },
		{ wch: 20 },
		{ wch: 20 },
		{ wch: 18 },
		{ wch: 22 },
		{ wch: 24 },
	];
	XLSX.utils.book_append_sheet(wb, wsVendors, 'Vendor Summary');

	// ── Write Workbook File ───────────────────────────────────────────────────
	const fileName = `E6_Outside_Jobs_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
	XLSX.writeFile(wb, fileName);
}
