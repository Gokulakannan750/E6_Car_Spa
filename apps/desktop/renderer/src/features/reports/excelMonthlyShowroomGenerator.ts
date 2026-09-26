/**
 * E6 Car Spa Management — Professional Monthly Showroom Management Excel Generator
 * Produces executive-grade operations & financial workbooks suitable for owner/management presentation:
 *  - Sheet 1: "Executive Summary" (Corporate Metadata, 7 Executive KPIs, Staff, Service & Vehicle Summaries)
 *  - Sheet 2: "Daily Operations" (Daily Operations Table with Date, Day, Staff, Vehicles, Services & Settlement)
 *  - Sheet 3: "Staff Performance" (Technician Workload, Home Showroom, Assignment Type, Working Days/Hours, Share %)
 *  - Sheet 4: "Service Analysis" (Service Operations Breakdown, Quantity, Vehicles & Volume Share %)
 *  - Sheet 5: "Vehicle Analysis" (Vehicle Fleet Classification, Serviced Counts & Fleet Share %)
 *  - Sheet 6: "Detailed Work Log" (Granular Vehicle Work & Service Audit Log with Auto-filters & Freeze Panes)
 *  - Sheet 7: "Billing & Collections" (Financial Daily Bills, Collections Received, Outstanding & Monthly Totals)
 */

import * as XLSX from 'xlsx';
import type {
	MonthlyShowroomReportResponse,
	MonthlyShowroomDetailDto,
} from '../../lib/api';

/**
 * Creates an ASCII progress / distribution bar (e.g., "██████░░░░ 60.0%")
 */
export function createProgressBar(percent: number): string {
	const clamped = Math.max(0, Math.min(100, isNaN(percent) ? 0 : percent));
	const totalBlocks = 10;
	const filledBlocks = Math.round((clamped / 100) * totalBlocks);
	const emptyBlocks = totalBlocks - filledBlocks;
	return `${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)} ${clamped.toFixed(1)}%`;
}

/**
 * Formats date into professional standard DD-MMM-YYYY (e.g., "01-Sep-2026")
 */
export function formatDateDisplay(dateStr: string): string {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return dateStr;
	const day = String(d.getDate()).padStart(2, '0');
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const month = months[d.getMonth()];
	const year = d.getFullYear();
	return `${day}-${month}-${year}`;
}

export function getDayOfWeek(dateStr: string): string {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return '—';
	return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

export function sanitizeSheetName(rawName: string, existingNames: Set<string>): string {
	const clean = rawName.replace(/[\\/?*[\]:]/g, '').trim().substring(0, 28) || 'Showroom';
	let finalName = clean;
	let counter = 1;
	while (existingNames.has(finalName.toLowerCase())) {
		finalName = `${clean.substring(0, 25)}_${counter}`;
		counter++;
	}
	existingNames.add(finalName.toLowerCase());
	return finalName;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. SHEET 1 — "Executive Summary"
// ────────────────────────────────────────────────────────────────────────────

export function generateExecutiveSummaryWorksheet(
	sr: MonthlyShowroomDetailDto,
	monthName: string,
	fromDate?: string,
	toDate?: string
): XLSX.WorkSheet {
	const sheetData: (string | number | null)[][] = [];

	// A. CORPORATE HEADER
	sheetData.push(['E6 CAR SPA']);
	sheetData.push(['Monthly Showroom Performance Report']);
	sheetData.push([]);

	// B. SHOWROOM DETAILS
	const reportPeriodStr = fromDate && toDate ? `${formatDateDisplay(fromDate)} to ${formatDateDisplay(toDate)}` : monthName;
	sheetData.push(['SHOWROOM DETAILS', '', '', '', '']);
	sheetData.push(['Showroom Name:', sr.showroomName, '', 'Showroom Master ID:', sr.showroomMasterId || '—']);
	sheetData.push(['Address:', sr.showroomAddress || '—', '', 'Phone:', sr.showroomPhone || '—']);
	sheetData.push(['GSTIN:', sr.showroomGstin || 'Not Registered', '', 'Report Month:', monthName]);
	sheetData.push(['Report Period:', reportPeriodStr, '', 'Generated On:', formatDateDisplay(new Date().toISOString())]);
	sheetData.push([]);

	// C. KPI CARDS / SUMMARY TABLE
	const avgBillPerVehicle =
		sr.summary.totalVehiclesServiced > 0
			? sr.summary.totalBilledAmount / sr.summary.totalVehiclesServiced
			: 0;

	const collectionRate =
		sr.summary.totalBilledAmount > 0
			? (sr.summary.totalCollectedAmount / sr.summary.totalBilledAmount) * 100
			: 0;

	// Calculate distinct operational days
	const distinctWorkingDays = new Set(sr.vehicleWorks.map((w) => w.date.substring(0, 10))).size;

	sheetData.push(['EXECUTIVE KEY PERFORMANCE INDICATORS (KPIs)']);
	sheetData.push([
		'TOTAL WORKING DAYS',
		'TOTAL STAFF ASSIGNED',
		'TOTAL VEHICLES SERVICED',
		'TOTAL SERVICES PERFORMED',
		'TOTAL BILLING (₹)',
		'TOTAL AMOUNT RECEIVED (₹)',
		'TOTAL OUTSTANDING (₹)',
		'AVERAGE BILL / VEHICLE (₹)',
		'COLLECTION RECOVERY RATE',
	]);
	sheetData.push([
		distinctWorkingDays || (sr.summary.totalBillingDays > 0 ? sr.summary.totalBillingDays : 0),
		sr.summary.totalActiveStaff,
		sr.summary.totalVehiclesServiced,
		sr.summary.totalServicesPerformed,
		sr.summary.totalBilledAmount,
		sr.summary.totalCollectedAmount,
		sr.summary.totalOutstandingAmount,
		Math.round(avgBillPerVehicle * 100) / 100,
		`${collectionRate.toFixed(1)}%`,
	]);
	sheetData.push([]);

	// D. SECTION A: STAFF SUMMARY
	sheetData.push(['A. STAFF WORKLOAD & PRODUCTIVITY SUMMARY']);
	sheetData.push([
		'Staff ID',
		'Staff Name',
		'Role',
		'Home Showroom',
		'Assignment Type',
		'Working Days',
		'Working Hours',
		'Vehicles Serviced',
		'Services Performed',
		'Workload Share (%)',
	]);

	const staffMap = new Map<
		string,
		{
			id: string;
			masterId: string;
			name: string;
			role: string;
			homeShowroom: string;
			assignmentType: string;
			vehicles: number;
			services: number;
			workingHours: number;
			activeDays: Set<string>;
		}
	>();

	sr.vehicleWorks.forEach((w) => {
		const cur = staffMap.get(w.staffId) || {
			id: w.staffId,
			masterId: w.staffMasterId,
			name: w.staffName,
			role: w.staffRole || 'Technician',
			homeShowroom: w.homeShowroomName || sr.showroomName,
			assignmentType: w.assignmentType || 'Regular',
			vehicles: 0,
			services: 0,
			workingHours: 0,
			activeDays: new Set<string>(),
		};
		cur.vehicles += w.vehicleQuantity;
		cur.services += w.serviceItems.reduce((acc, si) => acc + si.quantity, 0);
		cur.workingHours += Number(w.workingHours ?? 9);
		cur.activeDays.add(w.date.substring(0, 10));
		staffMap.set(w.staffId, cur);
	});

	const staffList = Array.from(staffMap.values()).sort((a, b) => b.vehicles - a.vehicles);
	const totalShowroomVehicles = Math.max(1, sr.summary.totalVehiclesServiced);

	if (staffList.length === 0) {
		sheetData.push(['No staff workload records logged for this showroom for the selected period.']);
	} else {
		staffList.forEach((st) => {
			const activeDaysCount = Math.max(1, st.activeDays.size);
			const sharePercent = (st.vehicles / totalShowroomVehicles) * 100;
			sheetData.push([
				st.masterId,
				st.name,
				st.role,
				st.homeShowroom,
				st.assignmentType,
				activeDaysCount,
				Math.round(st.workingHours * 10) / 10,
				st.vehicles,
				st.services,
				`${sharePercent.toFixed(1)}%`,
			]);
		});
	}
	sheetData.push([]);

	// E. SECTION B: SERVICE SUMMARY
	sheetData.push(['B. SERVICE & WORK TYPE SUMMARY']);
	sheetData.push([
		'Service Code',
		'Service Name',
		'Vehicles Attended',
		'Quantity Completed',
		'Share of Total Services (%)',
		'Volume Share Meter',
	]);

	const serviceMap = new Map<
		string,
		{ code: string; name: string; quantity: number; vehicles: number }
	>();

	sr.vehicleWorks.forEach((w) => {
		w.serviceItems.forEach((si) => {
			const cur = serviceMap.get(si.workTypeId) || {
				code: si.workTypeCode,
				name: si.workTypeName,
				quantity: 0,
				vehicles: 0,
			};
			cur.quantity += si.quantity;
			cur.vehicles += w.vehicleQuantity;
			serviceMap.set(si.workTypeId, cur);
		});
	});

	const serviceList = Array.from(serviceMap.values()).sort((a, b) => b.quantity - a.quantity);
	const totalShowroomServices = Math.max(1, sr.summary.totalServicesPerformed);

	if (serviceList.length === 0) {
		sheetData.push(['No service operations recorded for this showroom for the selected period.']);
	} else {
		serviceList.forEach((sv) => {
			const sharePercent = (sv.quantity / totalShowroomServices) * 100;
			sheetData.push([
				sv.code,
				sv.name,
				sv.vehicles,
				sv.quantity,
				`${sharePercent.toFixed(1)}%`,
				createProgressBar(sharePercent),
			]);
		});
	}
	sheetData.push([]);

	// F. SECTION C: VEHICLE TYPE SUMMARY
	sheetData.push(['C. VEHICLE TYPE CLASSIFICATION SUMMARY']);
	sheetData.push([
		'Vehicle Type Code',
		'Vehicle Type',
		'Vehicle Count',
		'Fleet Share (%)',
		'Composition Meter',
	]);

	const vehicleMap = new Map<
		string,
		{ code: string; name: string; count: number }
	>();

	sr.vehicleWorks.forEach((w) => {
		const cur = vehicleMap.get(w.vehicleTypeId) || {
			code: w.vehicleTypeCode || 'VEH',
			name: w.vehicleTypeName,
			count: 0,
		};
		cur.count += w.vehicleQuantity;
		vehicleMap.set(w.vehicleTypeId, cur);
	});

	const vehicleList = Array.from(vehicleMap.values()).sort((a, b) => b.count - a.count);

	if (vehicleList.length === 0) {
		sheetData.push(['No vehicle classification records logged for this period.']);
	} else {
		vehicleList.forEach((vh) => {
			const sharePercent = (vh.count / totalShowroomVehicles) * 100;
			sheetData.push([
				vh.code,
				vh.name,
				vh.count,
				`${sharePercent.toFixed(1)}%`,
				createProgressBar(sharePercent),
			]);
		});
	}

	const ws = XLSX.utils.aoa_to_sheet(sheetData);

	ws['!cols'] = [
		{ wch: 18 }, // Col A: Staff ID / Service Code / Vehicle Code
		{ wch: 26 }, // Col B: Name / Service Name / Vehicle Type
		{ wch: 18 }, // Col C: Role / Vehicles Attended / Count
		{ wch: 22 }, // Col D: Home Showroom / Quantity / Fleet Share
		{ wch: 22 }, // Col E: Assignment Type / Share % / Meter
		{ wch: 16 }, // Col F: Working Days
		{ wch: 16 }, // Col G: Working Hours
		{ wch: 18 }, // Col H: Vehicles Serviced
		{ wch: 18 }, // Col I: Services Performed
		{ wch: 18 }, // Col J: Share %
	];

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. SHEET 2 — "Daily Operations"
// ────────────────────────────────────────────────────────────────────────────

export function generateDailyOperationsWorksheet(
	sr: MonthlyShowroomDetailDto,
	monthName: string
): XLSX.WorkSheet {
	const sheetData: (string | number | null)[][] = [];

	sheetData.push(['E6 CAR SPA — DAILY OPERATIONS SUMMARY']);
	sheetData.push([`Showroom: ${sr.showroomName} (${sr.showroomMasterId}) | Period: ${monthName}`]);
	sheetData.push([`Total Work Operations: ${sr.vehicleWorks.length} | Export Date: ${formatDateDisplay(new Date().toISOString())}`]);
	sheetData.push([]);

	// Table Headers
	sheetData.push([
		'Date',
		'Day',
		'Staff ID',
		'Staff Name',
		'Vehicle Type',
		'Vehicle Count',
		'Service / Work Performed',
		'Working Hours',
		'Billing Amount (₹)',
		'Amount Received (₹)',
		'Outstanding (₹)',
	]);

	if (sr.vehicleWorks.length === 0) {
		sheetData.push(['No operational records found for this showroom for the selected period.']);
	} else {
		// Group or list granular operations
		sr.vehicleWorks.forEach((w) => {
			const servicesText = w.servicesSummary || (
				w.serviceItems.length > 0
					? w.serviceItems.map((s) => `${s.workTypeName} (${s.quantity})`).join(', ')
					: 'General Service'
			);

			sheetData.push([
				formatDateDisplay(w.date),
				getDayOfWeek(w.date),
				w.staffMasterId || '—',
				w.staffName,
				w.vehicleTypeName,
				w.vehicleQuantity,
				servicesText,
				w.workingHours !== null && w.workingHours !== undefined ? w.workingHours : 9,
				w.dailyBilledAmount !== null && w.dailyBilledAmount !== undefined ? w.dailyBilledAmount : '—',
				w.dailyCollectedAmount !== null && w.dailyCollectedAmount !== undefined ? w.dailyCollectedAmount : '—',
				w.dailyBilledAmount !== null && w.dailyCollectedAmount !== null && w.dailyBilledAmount !== undefined && w.dailyCollectedAmount !== undefined
					? Math.max(0, w.dailyBilledAmount - w.dailyCollectedAmount)
					: '—',
			]);
		});
	}

	const ws = XLSX.utils.aoa_to_sheet(sheetData);

	ws['!cols'] = [
		{ wch: 14 }, // Date
		{ wch: 8 },  // Day
		{ wch: 16 }, // Staff ID
		{ wch: 22 }, // Staff Name
		{ wch: 18 }, // Vehicle Type
		{ wch: 14 }, // Vehicle Count
		{ wch: 34 }, // Service Performed
		{ wch: 16 }, // Working Hours
		{ wch: 18 }, // Billing Amount
		{ wch: 18 }, // Amount Received
		{ wch: 18 }, // Outstanding
	];

	if (sr.vehicleWorks.length > 0) {
		ws['!autofilter'] = {
			ref: `A5:K${4 + sr.vehicleWorks.length}`,
		};
	}

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. SHEET 3 — "Staff Performance"
// ────────────────────────────────────────────────────────────────────────────

export function generateStaffPerformanceWorksheet(
	sr: MonthlyShowroomDetailDto,
	monthName: string
): XLSX.WorkSheet {
	const sheetData: (string | number | null)[][] = [];

	sheetData.push(['E6 CAR SPA — STAFF WORKLOAD & PERFORMANCE ANALYSIS']);
	sheetData.push([`Showroom: ${sr.showroomName} (${sr.showroomMasterId}) | Period: ${monthName}`]);
	sheetData.push([`Total Staff Active: ${sr.summary.totalActiveStaff} | Export Date: ${formatDateDisplay(new Date().toISOString())}`]);
	sheetData.push([]);

	// Table Headers
	sheetData.push([
		'Rank',
		'Staff ID',
		'Staff Name',
		'Role',
		'Home Showroom',
		'Assignment Type',
		'Working Days',
		'Scheduled Hours',
		'Actual/Recorded Hours',
		'Vehicles Serviced',
		'Services Performed',
		'Workload Share (%)',
		'Workload Distribution Meter',
	]);

	const staffMap = new Map<
		string,
		{
			id: string;
			masterId: string;
			name: string;
			role: string;
			homeShowroom: string;
			assignmentType: string;
			entries: number;
			vehicles: number;
			services: number;
			hours: number;
			activeDays: Set<string>;
		}
	>();

	sr.vehicleWorks.forEach((w) => {
		const cur = staffMap.get(w.staffId) || {
			id: w.staffId,
			masterId: w.staffMasterId,
			name: w.staffName,
			role: w.staffRole || 'Technician',
			homeShowroom: w.homeShowroomName || sr.showroomName,
			assignmentType: w.assignmentType || 'Regular',
			entries: 0,
			vehicles: 0,
			services: 0,
			hours: 0,
			activeDays: new Set<string>(),
		};
		cur.entries += 1;
		cur.vehicles += w.vehicleQuantity;
		cur.services += w.serviceItems.reduce((acc, si) => acc + si.quantity, 0);
		cur.hours += Number(w.workingHours ?? 9);
		cur.activeDays.add(w.date.substring(0, 10));
		staffMap.set(w.staffId, cur);
	});

	const staffList = Array.from(staffMap.values()).sort((a, b) => b.vehicles - a.vehicles);
	const totalVehicles = Math.max(1, sr.summary.totalVehiclesServiced);

	if (staffList.length === 0) {
		sheetData.push(['No staff workload records found for this period.']);
	} else {
		staffList.forEach((st, idx) => {
			const daysCount = Math.max(1, st.activeDays.size);
			const scheduledHours = daysCount * 9;
			const sharePercent = (st.vehicles / totalVehicles) * 100;

			sheetData.push([
				idx + 1,
				st.masterId,
				st.name,
				st.role,
				st.homeShowroom,
				st.assignmentType,
				daysCount,
				scheduledHours,
				Math.round(st.hours * 10) / 10,
				st.vehicles,
				st.services,
				`${sharePercent.toFixed(1)}%`,
				createProgressBar(sharePercent),
			]);
		});
	}

	const ws = XLSX.utils.aoa_to_sheet(sheetData);

	ws['!cols'] = [
		{ wch: 8 },  // Rank
		{ wch: 16 }, // Staff ID
		{ wch: 24 }, // Name
		{ wch: 16 }, // Role
		{ wch: 22 }, // Home Showroom
		{ wch: 20 }, // Assignment Type
		{ wch: 16 }, // Working Days
		{ wch: 16 }, // Scheduled Hours
		{ wch: 22 }, // Recorded Hours
		{ wch: 18 }, // Vehicles Serviced
		{ wch: 18 }, // Services Performed
		{ wch: 18 }, // Share %
		{ wch: 24 }, // Meter
	];

	if (staffList.length > 0) {
		ws['!autofilter'] = {
			ref: `A5:M${4 + staffList.length}`,
		};
	}

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 4. SHEET 4 — "Service Analysis"
// ────────────────────────────────────────────────────────────────────────────

export function generateServiceAnalysisWorksheet(
	sr: MonthlyShowroomDetailDto,
	monthName: string
): XLSX.WorkSheet {
	const sheetData: (string | number | null)[][] = [];

	sheetData.push(['E6 CAR SPA — SERVICE OPERATIONS & WORK TYPE ANALYSIS']);
	sheetData.push([`Showroom: ${sr.showroomName} (${sr.showroomMasterId}) | Period: ${monthName}`]);
	sheetData.push([`Total Services Performed: ${sr.summary.totalServicesPerformed} | Export Date: ${formatDateDisplay(new Date().toISOString())}`]);
	sheetData.push([]);

	// Table Headers
	sheetData.push([
		'Rank',
		'Service Code',
		'Service / Work Type Name',
		'Work Log Entries',
		'Vehicle Count',
		'Service Count / Quantity',
		'Percentage of Total Services (%)',
		'Volume Distribution Meter',
	]);

	const serviceMap = new Map<
		string,
		{ code: string; name: string; entries: number; quantity: number; vehicles: number }
	>();

	sr.vehicleWorks.forEach((w) => {
		w.serviceItems.forEach((si) => {
			const cur = serviceMap.get(si.workTypeId) || {
				code: si.workTypeCode,
				name: si.workTypeName,
				entries: 0,
				quantity: 0,
				vehicles: 0,
			};
			cur.entries += 1;
			cur.quantity += si.quantity;
			cur.vehicles += w.vehicleQuantity;
			serviceMap.set(si.workTypeId, cur);
		});
	});

	const serviceList = Array.from(serviceMap.values()).sort((a, b) => b.quantity - a.quantity);
	const totalServices = Math.max(1, sr.summary.totalServicesPerformed);

	if (serviceList.length === 0) {
		sheetData.push(['No service operations recorded for this showroom for the selected period.']);
	} else {
		serviceList.forEach((sv, idx) => {
			const sharePercent = (sv.quantity / totalServices) * 100;
			sheetData.push([
				idx + 1,
				sv.code,
				sv.name,
				sv.entries,
				sv.vehicles,
				sv.quantity,
				`${sharePercent.toFixed(1)}%`,
				createProgressBar(sharePercent),
			]);
		});
	}

	const ws = XLSX.utils.aoa_to_sheet(sheetData);

	ws['!cols'] = [
		{ wch: 8 },  // Rank
		{ wch: 16 }, // Service Code
		{ wch: 30 }, // Service Name
		{ wch: 18 }, // Entries
		{ wch: 16 }, // Vehicles
		{ wch: 24 }, // Quantity
		{ wch: 26 }, // Share %
		{ wch: 24 }, // Meter
	];

	if (serviceList.length > 0) {
		ws['!autofilter'] = {
			ref: `A5:H${4 + serviceList.length}`,
		};
	}

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 5. SHEET 5 — "Vehicle Analysis"
// ────────────────────────────────────────────────────────────────────────────

export function generateVehicleAnalysisWorksheet(
	sr: MonthlyShowroomDetailDto,
	monthName: string
): XLSX.WorkSheet {
	const sheetData: (string | number | null)[][] = [];

	sheetData.push(['E6 CAR SPA — VEHICLE FLEET CLASSIFICATION ANALYSIS']);
	sheetData.push([`Showroom: ${sr.showroomName} (${sr.showroomMasterId}) | Period: ${monthName}`]);
	sheetData.push([`Total Vehicles Serviced: ${sr.summary.totalVehiclesServiced} | Export Date: ${formatDateDisplay(new Date().toISOString())}`]);
	sheetData.push([]);

	// Table Headers
	sheetData.push([
		'Rank',
		'Vehicle Type Code',
		'Vehicle Classification',
		'Work Log Entries',
		'Vehicles Serviced',
		'Fleet Composition (%)',
		'Fleet Share Meter',
	]);

	const vehicleMap = new Map<
		string,
		{ code: string; name: string; entries: number; count: number }
	>();

	sr.vehicleWorks.forEach((w) => {
		const cur = vehicleMap.get(w.vehicleTypeId) || {
			code: w.vehicleTypeCode || 'VEH',
			name: w.vehicleTypeName,
			entries: 0,
			count: 0,
		};
		cur.entries += 1;
		cur.count += w.vehicleQuantity;
		vehicleMap.set(w.vehicleTypeId, cur);
	});

	const vehicleList = Array.from(vehicleMap.values()).sort((a, b) => b.count - a.count);
	const totalVehicles = Math.max(1, sr.summary.totalVehiclesServiced);

	if (vehicleList.length === 0) {
		sheetData.push(['No vehicle classification records found for this period.']);
	} else {
		vehicleList.forEach((vh, idx) => {
			const sharePercent = (vh.count / totalVehicles) * 100;
			sheetData.push([
				idx + 1,
				vh.code,
				vh.name,
				vh.entries,
				vh.count,
				`${sharePercent.toFixed(1)}%`,
				createProgressBar(sharePercent),
			]);
		});
	}

	const ws = XLSX.utils.aoa_to_sheet(sheetData);

	ws['!cols'] = [
		{ wch: 8 },  // Rank
		{ wch: 18 }, // Vehicle Type Code
		{ wch: 28 }, // Vehicle Classification
		{ wch: 18 }, // Work Log Entries
		{ wch: 18 }, // Vehicles Serviced
		{ wch: 22 }, // Fleet Composition %
		{ wch: 24 }, // Composition Meter
	];

	if (vehicleList.length > 0) {
		ws['!autofilter'] = {
			ref: `A5:G${4 + vehicleList.length}`,
		};
	}

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 6. SHEET 6 — "Detailed Work Log"
// ────────────────────────────────────────────────────────────────────────────

export function generateDetailedWorkLogWorksheet(
	sr: MonthlyShowroomDetailDto,
	monthName: string
): XLSX.WorkSheet {
	const sheetData: (string | number | null)[][] = [];

	sheetData.push(['E6 CAR SPA — DETAILED VEHICLE SERVICE AUDIT LOG']);
	sheetData.push([`Showroom: ${sr.showroomName} (${sr.showroomMasterId}) | Period: ${monthName} | Total Records: ${sr.vehicleWorks.length}`]);
	sheetData.push([`Generated On: ${formatDateDisplay(new Date().toISOString())}`]);
	sheetData.push([]);

	// Table Headers
	sheetData.push([
		'Date',
		'Time',
		'Staff ID',
		'Staff Name',
		'Home Showroom',
		'Assignment Type',
		'Vehicle Number / Reference',
		'Vehicle Type',
		'Service / Work Performed',
		'Work Session',
		'Notes',
	]);

	if (sr.vehicleWorks.length === 0) {
		sheetData.push(['No detailed vehicle service records found for this showroom for the selected period.']);
	} else {
		sr.vehicleWorks.forEach((w, idx) => {
			const servicesText = w.servicesSummary || (
				w.serviceItems.length > 0
					? w.serviceItems.map((s) => `${s.workTypeName} (${s.quantity})`).join(', ')
					: 'General Service'
			);

			sheetData.push([
				formatDateDisplay(w.date),
				w.timeRecorded || '—',
				w.staffMasterId || '—',
				w.staffName,
				w.homeShowroomName || sr.showroomName,
				w.assignmentType || 'Regular',
				`REF-${String(idx + 1).padStart(4, '0')}`,
				w.vehicleTypeName,
				servicesText,
				w.sessionType || 'FullDay',
				w.notes || '—',
			]);
		});
	}

	const ws = XLSX.utils.aoa_to_sheet(sheetData);

	ws['!cols'] = [
		{ wch: 14 }, // Date
		{ wch: 10 }, // Time
		{ wch: 16 }, // Staff ID
		{ wch: 22 }, // Staff Name
		{ wch: 22 }, // Home Showroom
		{ wch: 20 }, // Assignment Type
		{ wch: 26 }, // Reference
		{ wch: 18 }, // Vehicle Type
		{ wch: 34 }, // Service Performed
		{ wch: 16 }, // Work Session
		{ wch: 28 }, // Notes
	];

	if (sr.vehicleWorks.length > 0) {
		ws['!autofilter'] = {
			ref: `A5:K${4 + sr.vehicleWorks.length}`,
		};
	}

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 7. SHEET 7 — "Billing & Collections"
// ────────────────────────────────────────────────────────────────────────────

export function generateBillingCollectionsWorksheet(
	sr: MonthlyShowroomDetailDto,
	monthName: string
): XLSX.WorkSheet {
	const sheetData: (string | number | null)[][] = [];

	sheetData.push(['E6 CAR SPA — MONTHLY BILLING & COLLECTIONS LEDGER']);
	sheetData.push([`Showroom: ${sr.showroomName} (${sr.showroomMasterId}) | Period: ${monthName}`]);
	sheetData.push([`Total Settlement Records: ${sr.dailyBills.length} | Export Date: ${formatDateDisplay(new Date().toISOString())}`]);
	sheetData.push([]);

	// Table Headers
	sheetData.push([
		'Date',
		'Day',
		'Daily Bill (₹)',
		'Amount Received (₹)',
		'Outstanding (₹)',
		'Payment Status',
		'Payment Count',
		'Settlement Notes',
	]);

	if (sr.dailyBills.length === 0) {
		sheetData.push(['No daily settlement or billing records recorded for this showroom in the selected period.']);
	} else {
		sr.dailyBills.forEach((b) => {
			sheetData.push([
				formatDateDisplay(b.date),
				getDayOfWeek(b.date),
				b.amount,
				b.paidAmount,
				b.balanceAmount,
				b.status,
				b.paymentCount,
				b.notes || '—',
			]);
		});
	}

	sheetData.push([]);
	sheetData.push(['--------------------------------------------------------------------------------------------------------']);
	sheetData.push(['MONTHLY FINANCIAL SETTLEMENT TOTALS']);
	sheetData.push(['--------------------------------------------------------------------------------------------------------']);

	const recoveryRate =
		sr.summary.totalBilledAmount > 0
			? (sr.summary.totalCollectedAmount / sr.summary.totalBilledAmount) * 100
			: 0;

	sheetData.push(['Total Billed Amount (₹):', sr.summary.totalBilledAmount]);
	sheetData.push(['Total Amount Received (₹):', sr.summary.totalCollectedAmount]);
	sheetData.push(['Total Outstanding Balance (₹):', sr.summary.totalOutstandingAmount]);
	sheetData.push(['Collection Recovery Rate (%):', `${recoveryRate.toFixed(1)}%`]);
	sheetData.push(['Total Settled Days (Paid):', sr.summary.paidDaysCount]);
	sheetData.push(['Partially Paid Days:', sr.summary.partiallyPaidDaysCount]);
	sheetData.push(['Unpaid / Pending Days:', sr.summary.unpaidDaysCount]);

	const ws = XLSX.utils.aoa_to_sheet(sheetData);

	ws['!cols'] = [
		{ wch: 16 }, // Date / Metric Label
		{ wch: 10 }, // Day / Value
		{ wch: 20 }, // Daily Bill
		{ wch: 22 }, // Amount Received
		{ wch: 18 }, // Outstanding
		{ wch: 18 }, // Payment Status
		{ wch: 16 }, // Payment Count
		{ wch: 30 }, // Notes
	];

	if (sr.dailyBills.length > 0) {
		ws['!autofilter'] = {
			ref: `A5:H${4 + sr.dailyBills.length}`,
		};
	}

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// MASTER WORKBOOK BUILDER & EXPORT DISPATCHER
// ────────────────────────────────────────────────────────────────────────────

export function exportSingleShowroomWorkbook(
	targetShowroom: MonthlyShowroomDetailDto,
	reportData: MonthlyShowroomReportResponse
): XLSX.WorkBook {
	const wb = XLSX.utils.book_new();

	// Sheet 1: Executive Summary
	const wsExecutive = generateExecutiveSummaryWorksheet(
		targetShowroom,
		reportData.monthName,
		reportData.fromDate,
		reportData.toDate
	);
	XLSX.utils.book_append_sheet(wb, wsExecutive, 'Executive Summary');

	// Sheet 2: Daily Operations
	const wsDaily = generateDailyOperationsWorksheet(targetShowroom, reportData.monthName);
	XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Operations');

	// Sheet 3: Staff Performance
	const wsStaff = generateStaffPerformanceWorksheet(targetShowroom, reportData.monthName);
	XLSX.utils.book_append_sheet(wb, wsStaff, 'Staff Performance');

	// Sheet 4: Service Analysis
	const wsService = generateServiceAnalysisWorksheet(targetShowroom, reportData.monthName);
	XLSX.utils.book_append_sheet(wb, wsService, 'Service Analysis');

	// Sheet 5: Vehicle Analysis
	const wsVehicle = generateVehicleAnalysisWorksheet(targetShowroom, reportData.monthName);
	XLSX.utils.book_append_sheet(wb, wsVehicle, 'Vehicle Analysis');

	// Sheet 6: Detailed Work Log
	const wsDetailed = generateDetailedWorkLogWorksheet(targetShowroom, reportData.monthName);
	XLSX.utils.book_append_sheet(wb, wsDetailed, 'Detailed Work Log');

	// Sheet 7: Billing & Collections
	const wsBilling = generateBillingCollectionsWorksheet(targetShowroom, reportData.monthName);
	XLSX.utils.book_append_sheet(wb, wsBilling, 'Billing & Collections');

	return wb;
}

export function generateAndDownloadMonthlyShowroomReport(
	reportData: MonthlyShowroomReportResponse,
	mode: 'selected' | 'all',
	selectedShowroomId?: string
) {
	if (mode === 'selected' || (selectedShowroomId && selectedShowroomId !== 'all')) {
		// Single Showroom Mode -> Produces the complete 7-Sheet Executive Management Report
		const targetShowroom =
			selectedShowroomId && selectedShowroomId !== 'all'
				? reportData.showrooms.find((s) => s.showroomId === selectedShowroomId) ||
				  reportData.showrooms[0]
				: reportData.showrooms[0];

		if (targetShowroom) {
			const wb = exportSingleShowroomWorkbook(targetShowroom, reportData);
			const fileName = `E6_Car_Spa_${targetShowroom.showroomName.replace(/\s+/g, '_')}_Monthly_Report_${reportData.monthName.replace(/\s+/g, '_')}.xlsx`;
			XLSX.writeFile(wb, fileName);
			return;
		}
	}

	// Multi-Showroom Mode -> Each showroom receives its own independent 7-Sheet workbook
	if (reportData.showrooms && reportData.showrooms.length > 0) {
		reportData.showrooms.forEach((sr) => {
			const wb = exportSingleShowroomWorkbook(sr, reportData);
			const fileName = `E6_Car_Spa_${sr.showroomName.replace(/\s+/g, '_')}_Monthly_Report_${reportData.monthName.replace(/\s+/g, '_')}.xlsx`;
			XLSX.writeFile(wb, fileName);
		});
		return;
	}

	// Fallback empty workbook
	const wb = XLSX.utils.book_new();
	const emptyWs = XLSX.utils.aoa_to_sheet([['No showroom data available for export']]);
	XLSX.utils.book_append_sheet(wb, emptyWs, 'No Data');
	const fileName = `E6_Car_Spa_Monthly_Showroom_Report_${reportData.monthName.replace(/\s+/g, '_')}.xlsx`;
	XLSX.writeFile(wb, fileName);
}

export const exportMonthlyShowroomToExcel = generateAndDownloadMonthlyShowroomReport;

