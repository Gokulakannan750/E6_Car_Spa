/**
 * E6 Car Spa Management — Professional Showroom Management Excel Generator
 * Produces executive-grade operations & financial workbooks:
 *  - Sheet 1: "Summary" (Executive KPIs, Service Summary, Vehicle Summary, Staff Summary)
 *  - Sheet 2: "Vehicle Service Details" (Every granular service/work record with swap info)
 *  - Sheet 3: "Staff Productivity" (Staff workload breakdown by Vehicle Type & Service with swap coverage)
 *  - Sheet 4: "Attendance" (Scheduled vs actual hours, confirmation lock status, confirmed by/at)
 *  - Sheet 5: "Staff Swaps" (Swap ID, Original/Replacement staff, coverage period, hours, Active/Reversed status)
 *  - Sheet 6: "Vehicle Type Summary" (Vehicle Type, Vehicles, Services, Staff Hours, Share %)
 *  - Sheet 7: "Service Summary" (Category, Service, Vehicles, Quantity, Staff Hours, Share %)
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
// 1. SHEET 1 — "Summary"
// ────────────────────────────────────────────────────────────────────────────

export function generateExecutiveSummaryWorksheet(
	sr: MonthlyShowroomDetailDto,
	monthName: string,
	fromDate?: string,
	toDate?: string
): XLSX.WorkSheet {
	const sheetData: (string | number | null)[][] = [];

	// Header
	sheetData.push(['E6 CAR SPA — SHOWROOM MANAGEMENT REPORT']);
	sheetData.push(['EXECUTIVE SUMMARY']);
	sheetData.push([]);

	// Metadata
	const reportPeriodStr = fromDate && toDate ? `${formatDateDisplay(fromDate)} to ${formatDateDisplay(toDate)}` : monthName;
	sheetData.push(['Showroom:', sr.showroomName]);
	sheetData.push(['Report Period:', reportPeriodStr]);
	sheetData.push(['Generated Date:', formatDateDisplay(new Date().toISOString())]);
	sheetData.push(['Showroom ID / Master Code:', sr.showroomMasterId || '—']);
	sheetData.push(['GSTIN:', sr.showroomGstin || 'Not Registered']);
	sheetData.push([]);

	// KPIs Section
	sheetData.push(['KEY PERFORMANCE INDICATORS (KPIs)']);
	sheetData.push([
		'Total Vehicles Serviced',
		'Total Services',
		'Total Staff',
		'Total Staff Hours',
		'Total Attendance Days',
		'Total Swaps',
		'Total Billed (₹)',
		'Total Received (₹)',
		'Total Outstanding (₹)',
	]);

	const totalStaffHours = sr.summary.totalStaffHours ?? (sr.staffSummary ? sr.staffSummary.reduce((a, b) => a + Number(b.totalHours), 0) : 0);
	const totalAttendanceDays = sr.summary.totalAttendanceDays ?? (sr.attendanceRecords ? sr.attendanceRecords.length : 0);
	const totalSwaps = sr.summary.totalSwaps ?? (sr.swaps ? sr.swaps.length : 0);

	sheetData.push([
		sr.summary.totalVehiclesServiced,
		sr.summary.totalServicesPerformed,
		sr.summary.totalActiveStaff,
		Math.round(totalStaffHours * 10) / 10,
		totalAttendanceDays,
		totalSwaps,
		sr.summary.totalBilledAmount,
		sr.summary.totalCollectedAmount,
		sr.summary.totalOutstandingAmount,
	]);
	sheetData.push([]);

	// Service Summary Section
	sheetData.push(['SERVICE SUMMARY']);
	sheetData.push(['Service Category', 'Service', 'Vehicles', 'Count']);

	if (sr.serviceSummary && sr.serviceSummary.length > 0) {
		sr.serviceSummary.forEach((sv) => {
			sheetData.push([
				sv.serviceCategory || 'General',
				sv.serviceName,
				sv.totalVehicles,
				sv.totalQuantity,
			]);
		});
	} else {
		// Fallback from vehicleWorks
		const srvMap = new Map<string, { cat: string; name: string; vehicles: number; count: number }>();
		sr.vehicleWorks.forEach((w) => {
			w.serviceItems.forEach((si) => {
				const cur = srvMap.get(si.workTypeId) || { cat: 'General', name: si.workTypeName, vehicles: 0, count: 0 };
				cur.count += si.quantity;
				cur.vehicles += w.vehicleQuantity;
				srvMap.set(si.workTypeId, cur);
			});
		});
		if (srvMap.size === 0) {
			sheetData.push(['—', 'No services logged', 0, 0]);
		} else {
			srvMap.forEach((v) => {
				sheetData.push([v.cat, v.name, v.vehicles, v.count]);
			});
		}
	}
	sheetData.push([]);

	// Vehicle Summary Section
	sheetData.push(['VEHICLE SUMMARY']);
	sheetData.push(['Vehicle Type', 'Vehicles', 'Services']);

	if (sr.vehicleTypeSummary && sr.vehicleTypeSummary.length > 0) {
		sr.vehicleTypeSummary.forEach((vt) => {
			sheetData.push([
				vt.vehicleTypeName,
				vt.totalVehicles,
				vt.totalServices,
			]);
		});
	} else {
		const vtMap = new Map<string, { name: string; vehicles: number; services: number }>();
		sr.vehicleWorks.forEach((w) => {
			const cur = vtMap.get(w.vehicleTypeId) || { name: w.vehicleTypeName, vehicles: 0, services: 0 };
			cur.vehicles += w.vehicleQuantity;
			cur.services += w.serviceItems.reduce((acc, si) => acc + si.quantity, 0);
			vtMap.set(w.vehicleTypeId, cur);
		});
		if (vtMap.size === 0) {
			sheetData.push(['No vehicle types logged', 0, 0]);
		} else {
			vtMap.forEach((v) => {
				sheetData.push([v.name, v.vehicles, v.services]);
			});
		}
	}
	sheetData.push([]);

	// Staff Summary Section
	sheetData.push(['STAFF SUMMARY']);
	sheetData.push(['Staff', 'Vehicles', 'Services', 'Hours', 'Attendance Days']);

	if (sr.staffSummary && sr.staffSummary.length > 0) {
		sr.staffSummary.forEach((st) => {
			sheetData.push([
				st.staffName,
				st.totalVehicles,
				st.totalServices,
				st.totalHours,
				st.attendanceDays,
			]);
		});
	} else {
		const stMap = new Map<string, { name: string; vehicles: number; services: number; hours: number; days: Set<string> }>();
		sr.vehicleWorks.forEach((w) => {
			const cur = stMap.get(w.staffId) || { name: w.staffName, vehicles: 0, services: 0, hours: 0, days: new Set<string>() };
			cur.vehicles += w.vehicleQuantity;
			cur.services += w.serviceItems.reduce((acc, si) => acc + si.quantity, 0);
			cur.hours += Number(w.workingHours ?? 9);
			cur.days.add(w.date.substring(0, 10));
			stMap.set(w.staffId, cur);
		});
		if (stMap.size === 0) {
			sheetData.push(['No staff logged', 0, 0, 0, 0]);
		} else {
			stMap.forEach((v) => {
				sheetData.push([v.name, v.vehicles, v.services, Math.round(v.hours * 10) / 10, v.days.size]);
			});
		}
	}

	const ws = XLSX.utils.aoa_to_sheet(sheetData);

	ws['!cols'] = [
		{ wch: 24 }, // Col A
		{ wch: 28 }, // Col B
		{ wch: 18 }, // Col C
		{ wch: 18 }, // Col D
		{ wch: 20 }, // Col E
		{ wch: 16 }, // Col F
		{ wch: 18 }, // Col G
		{ wch: 18 }, // Col H
		{ wch: 20 }, // Col I
	];

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. SHEET 2 — "Vehicle Service Details"
// ────────────────────────────────────────────────────────────────────────────

export function generateVehicleServiceDetailsWorksheet(
	sr: MonthlyShowroomDetailDto,
	monthName: string
): XLSX.WorkSheet {
	const sheetData: (string | number | null)[][] = [];

	sheetData.push(['E6 CAR SPA — VEHICLE SERVICE DETAILS']);
	sheetData.push([`Showroom: ${sr.showroomName} (${sr.showroomMasterId}) | Period: ${monthName}`]);
	sheetData.push([`Generated On: ${formatDateDisplay(new Date().toISOString())}`]);
	sheetData.push([]);

	// Table Headers
	sheetData.push([
		'Date',
		'Showroom',
		'Job/Vehicle ID',
		'Vehicle Registration',
		'Vehicle Make/Model',
		'Vehicle Type',
		'Service Category',
		'Service',
		'Staff ID',
		'Staff Name',
		'Start Time',
		'End Time',
		'Hours',
		'Work Status',
		'Assignment Type',
		'Swap ID',
	]);

	if (sr.vehicleWorks.length === 0) {
		sheetData.push(['No vehicle service records found for this showroom for the selected period.']);
	} else {
		sr.vehicleWorks.forEach((w, idx) => {
			const servicesText = w.servicesSummary || (
				w.serviceItems.length > 0
					? w.serviceItems.map((s) => `${s.workTypeName} (${s.quantity})`).join(', ')
					: 'General Service'
			);

			const serviceCat = w.serviceCategory || (w.serviceItems && w.serviceItems.length > 0 ? 'General' : 'General');
			const jobVehicleId = `JOB-${String(idx + 1).padStart(4, '0')}`;

			sheetData.push([
				formatDateDisplay(w.date),
				w.showroomName || sr.showroomName,
				jobVehicleId,
				'—', // Vehicle Registration if available
				'—', // Vehicle Make/Model if available
				w.vehicleTypeName,
				serviceCat,
				servicesText,
				w.staffMasterId || '—',
				w.staffName,
				w.startTime || '09:00',
				w.endTime || '18:00',
				w.workingHours != null ? w.workingHours : 9,
				'Completed',
				w.assignmentType || 'Regular',
				w.swapId || '—',
			]);
		});
	}

	const ws = XLSX.utils.aoa_to_sheet(sheetData);

	ws['!cols'] = [
		{ wch: 14 }, // Date
		{ wch: 22 }, // Showroom
		{ wch: 16 }, // Job/Vehicle ID
		{ wch: 20 }, // Vehicle Registration
		{ wch: 18 }, // Vehicle Make/Model
		{ wch: 18 }, // Vehicle Type
		{ wch: 18 }, // Service Category
		{ wch: 30 }, // Service
		{ wch: 16 }, // Staff ID
		{ wch: 22 }, // Staff Name
		{ wch: 12 }, // Start Time
		{ wch: 12 }, // End Time
		{ wch: 10 }, // Hours
		{ wch: 14 }, // Work Status
		{ wch: 18 }, // Assignment Type
		{ wch: 16 }, // Swap ID
	];

	if (sr.vehicleWorks.length > 0) {
		ws['!autofilter'] = {
			ref: `A5:P${4 + sr.vehicleWorks.length}`,
		};
	}

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. SHEET 3 — "Staff Productivity"
// ────────────────────────────────────────────────────────────────────────────

export function generateStaffProductivityWorksheet(
	sr: MonthlyShowroomDetailDto,
	monthName: string
): XLSX.WorkSheet {
	const sheetData: (string | number | null)[][] = [];

	sheetData.push(['E6 CAR SPA — STAFF PRODUCTIVITY AUDIT']);
	sheetData.push([`Showroom: ${sr.showroomName} (${sr.showroomMasterId}) | Period: ${monthName}`]);
	sheetData.push([`Generated On: ${formatDateDisplay(new Date().toISOString())}`]);
	sheetData.push([]);

	// Table Headers
	sheetData.push([
		'Date',
		'Staff ID',
		'Staff Name',
		'Role',
		'Home Showroom',
		'Working Showroom',
		'Vehicle Type',
		'Service Category',
		'Service',
		'Vehicle/Job ID',
		'Vehicles',
		'Start Time',
		'End Time',
		'Hours',
		'Assignment Type',
		'Swap ID',
		'Original Staff',
		'Replacement Staff',
	]);

	if (sr.vehicleWorks.length === 0) {
		sheetData.push(['No staff productivity records found for this showroom for the selected period.']);
	} else {
		sr.vehicleWorks.forEach((w, idx) => {
			const servicesText = w.servicesSummary || (
				w.serviceItems.length > 0
					? w.serviceItems.map((s) => `${s.workTypeName} (${s.quantity})`).join(', ')
					: 'General Service'
			);
			const jobVehicleId = `JOB-${String(idx + 1).padStart(4, '0')}`;
			const serviceCat = w.serviceCategory || 'General';

			sheetData.push([
				formatDateDisplay(w.date),
				w.staffMasterId || '—',
				w.staffName,
				w.staffRole || 'Technician',
				w.homeShowroomName || sr.showroomName,
				w.showroomName || sr.showroomName,
				w.vehicleTypeName,
				serviceCat,
				servicesText,
				jobVehicleId,
				w.vehicleQuantity,
				w.startTime || '09:00',
				w.endTime || '18:00',
				w.workingHours != null ? w.workingHours : 9,
				w.assignmentType || 'Regular',
				w.swapId || '—',
				w.originalStaffName || '—',
				w.replacementStaffName || '—',
			]);
		});
	}

	const ws = XLSX.utils.aoa_to_sheet(sheetData);

	ws['!cols'] = [
		{ wch: 14 }, // Date
		{ wch: 16 }, // Staff ID
		{ wch: 22 }, // Staff Name
		{ wch: 16 }, // Role
		{ wch: 20 }, // Home Showroom
		{ wch: 20 }, // Working Showroom
		{ wch: 18 }, // Vehicle Type
		{ wch: 18 }, // Service Category
		{ wch: 28 }, // Service
		{ wch: 16 }, // Vehicle/Job ID
		{ wch: 12 }, // Vehicles
		{ wch: 12 }, // Start Time
		{ wch: 12 }, // End Time
		{ wch: 10 }, // Hours
		{ wch: 18 }, // Assignment Type
		{ wch: 16 }, // Swap ID
		{ wch: 20 }, // Original Staff
		{ wch: 20 }, // Replacement Staff
	];

	if (sr.vehicleWorks.length > 0) {
		ws['!autofilter'] = {
			ref: `A5:R${4 + sr.vehicleWorks.length}`,
		};
	}

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 4. SHEET 4 — "Attendance"
// ────────────────────────────────────────────────────────────────────────────

export function generateAttendanceWorksheet(
	sr: MonthlyShowroomDetailDto,
	monthName: string
): XLSX.WorkSheet {
	const sheetData: (string | number | null)[][] = [];

	sheetData.push(['E6 CAR SPA — ATTENDANCE AUDIT LEDGER']);
	sheetData.push([`Showroom: ${sr.showroomName} (${sr.showroomMasterId}) | Period: ${monthName}`]);
	sheetData.push([`Generated On: ${formatDateDisplay(new Date().toISOString())}`]);
	sheetData.push([]);

	// Table Headers
	sheetData.push([
		'Date',
		'Staff ID',
		'Staff Name',
		'Role',
		'Home Showroom',
		'Working Showroom',
		'Attendance Status',
		'Scheduled Start',
		'Scheduled End',
		'Scheduled Hours',
		'Actual/Recorded Hours',
		'Confirmation Status',
		'Confirmed By',
		'Confirmed At',
	]);

	if (!sr.attendanceRecords || sr.attendanceRecords.length === 0) {
		sheetData.push(['No attendance records found for this showroom for the selected period.']);
	} else {
		sr.attendanceRecords.forEach((att) => {
			sheetData.push([
				formatDateDisplay(att.date),
				att.staffMasterId || '—',
				att.staffName,
				att.role || 'Technician',
				att.homeShowroomName || sr.showroomName,
				att.workingShowroomName || sr.showroomName,
				att.attendanceStatus || 'Present',
				att.scheduledStart || '09:00',
				att.scheduledEnd || '18:00',
				att.scheduledHours,
				att.actualHours,
				att.confirmationStatus || 'Pending',
				att.confirmedByName || '—',
				att.confirmedAt ? formatDateDisplay(att.confirmedAt) : '—',
			]);
		});
	}

	const ws = XLSX.utils.aoa_to_sheet(sheetData);

	ws['!cols'] = [
		{ wch: 14 }, // Date
		{ wch: 16 }, // Staff ID
		{ wch: 22 }, // Staff Name
		{ wch: 16 }, // Role
		{ wch: 20 }, // Home Showroom
		{ wch: 20 }, // Working Showroom
		{ wch: 18 }, // Attendance Status
		{ wch: 16 }, // Scheduled Start
		{ wch: 16 }, // Scheduled End
		{ wch: 16 }, // Scheduled Hours
		{ wch: 20 }, // Actual/Recorded Hours
		{ wch: 20 }, // Confirmation Status
		{ wch: 20 }, // Confirmed By
		{ wch: 16 }, // Confirmed At
	];

	if (sr.attendanceRecords && sr.attendanceRecords.length > 0) {
		ws['!autofilter'] = {
			ref: `A5:N${4 + sr.attendanceRecords.length}`,
		};
	}

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 5. SHEET 5 — "Staff Swaps"
// ────────────────────────────────────────────────────────────────────────────

export function generateStaffSwapsWorksheet(
	sr: MonthlyShowroomDetailDto,
	monthName: string
): XLSX.WorkSheet {
	const sheetData: (string | number | null)[][] = [];

	sheetData.push(['E6 CAR SPA — STAFF SWAPS & COVERAGE AUDIT LEDGER']);
	sheetData.push([`Showroom: ${sr.showroomName} (${sr.showroomMasterId}) | Period: ${monthName}`]);
	sheetData.push([`Generated On: ${formatDateDisplay(new Date().toISOString())}`]);
	sheetData.push([]);

	// Table Headers
	sheetData.push([
		'Swap ID',
		'Date',
		'Showroom',
		'Original Staff ID',
		'Original Staff Name',
		'Replacement Staff ID',
		'Replacement Staff Name',
		'Original Working Time',
		'Replacement Working Time',
		'Swap Start Time',
		'Swap End Time',
		'Swap Hours',
		'Reason',
		'Created By',
		'Created At',
		'Status',
		'Reversed By',
		'Reversed At',
		'Reversal Reason',
	]);

	if (!sr.swaps || sr.swaps.length === 0) {
		sheetData.push(['No staff swaps recorded for this showroom for the selected period.']);
	} else {
		sr.swaps.forEach((swp) => {
			sheetData.push([
				swp.swapId,
				formatDateDisplay(swp.date),
				swp.showroomName || sr.showroomName,
				swp.staffAMasterId || '—',
				swp.staffAName,
				swp.staffBMasterId || '—',
				swp.staffBName,
				swp.originalWorkingTime || '09:00–18:00',
				swp.replacementWorkingTime || '09:00–18:00',
				swp.swapStartTime || '—',
				swp.swapEndTime || '—',
				swp.swapHours,
				swp.reason || 'Operational Coverage',
				swp.createdByName || 'Supervisor',
				formatDateDisplay(swp.createdAt),
				swp.status,
				swp.reversedByName || '—',
				swp.reversedAt ? formatDateDisplay(swp.reversedAt) : '—',
				swp.reversalReason || '—',
			]);
		});
	}

	const ws = XLSX.utils.aoa_to_sheet(sheetData);

	ws['!cols'] = [
		{ wch: 16 }, // Swap ID
		{ wch: 14 }, // Date
		{ wch: 22 }, // Showroom
		{ wch: 18 }, // Original Staff ID
		{ wch: 22 }, // Original Staff Name
		{ wch: 20 }, // Replacement Staff ID
		{ wch: 22 }, // Replacement Staff Name
		{ wch: 22 }, // Original Working Time
		{ wch: 24 }, // Replacement Working Time
		{ wch: 16 }, // Swap Start Time
		{ wch: 16 }, // Swap End Time
		{ wch: 12 }, // Swap Hours
		{ wch: 26 }, // Reason
		{ wch: 18 }, // Created By
		{ wch: 16 }, // Created At
		{ wch: 14 }, // Status
		{ wch: 18 }, // Reversed By
		{ wch: 16 }, // Reversed At
		{ wch: 24 }, // Reversal Reason
	];

	if (sr.swaps && sr.swaps.length > 0) {
		ws['!autofilter'] = {
			ref: `A5:S${4 + sr.swaps.length}`,
		};
	}

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 6. SHEET 6 — "Vehicle Type Summary"
// ────────────────────────────────────────────────────────────────────────────

export function generateVehicleTypeSummaryWorksheet(
	sr: MonthlyShowroomDetailDto,
	monthName: string
): XLSX.WorkSheet {
	const sheetData: (string | number | null)[][] = [];

	sheetData.push(['E6 CAR SPA — VEHICLE TYPE SUMMARY']);
	sheetData.push([`Showroom: ${sr.showroomName} (${sr.showroomMasterId}) | Period: ${monthName}`]);
	sheetData.push([`Total Vehicles: ${sr.summary.totalVehiclesServiced} | Export Date: ${formatDateDisplay(new Date().toISOString())}`]);
	sheetData.push([]);

	// Table Headers
	sheetData.push([
		'Vehicle Type',
		'Vehicles',
		'Services',
		'Staff Hours',
		'Share (%)',
		'Distribution Meter',
	]);

	if (sr.vehicleTypeSummary && sr.vehicleTypeSummary.length > 0) {
		sr.vehicleTypeSummary.forEach((vt) => {
			sheetData.push([
				vt.vehicleTypeName,
				vt.totalVehicles,
				vt.totalServices,
				vt.totalStaffHours,
				`${vt.sharePercentage.toFixed(1)}%`,
				createProgressBar(vt.sharePercentage),
			]);
		});
	} else {
		// Fallback calculation
		const vtMap = new Map<string, { name: string; vehicles: number; services: number; hours: number }>();
		sr.vehicleWorks.forEach((w) => {
			const cur = vtMap.get(w.vehicleTypeId) || { name: w.vehicleTypeName, vehicles: 0, services: 0, hours: 0 };
			cur.vehicles += w.vehicleQuantity;
			cur.services += w.serviceItems.reduce((acc, si) => acc + si.quantity, 0);
			cur.hours += Number(w.workingHours ?? 9);
			vtMap.set(w.vehicleTypeId, cur);
		});

		const totalV = Math.max(1, sr.summary.totalVehiclesServiced);
		if (vtMap.size === 0) {
			sheetData.push(['No vehicle type records found.', 0, 0, 0, '0.0%', '']);
		} else {
			vtMap.forEach((v) => {
				const pct = (v.vehicles / totalV) * 100;
				sheetData.push([
					v.name,
					v.vehicles,
					v.services,
					Math.round(v.hours * 10) / 10,
					`${pct.toFixed(1)}%`,
					createProgressBar(pct),
				]);
			});
		}
	}

	const ws = XLSX.utils.aoa_to_sheet(sheetData);

	ws['!cols'] = [
		{ wch: 24 }, // Vehicle Type
		{ wch: 16 }, // Vehicles
		{ wch: 16 }, // Services
		{ wch: 16 }, // Staff Hours
		{ wch: 16 }, // Share %
		{ wch: 24 }, // Meter
	];

	return ws;
}

// ────────────────────────────────────────────────────────────────────────────
// 7. SHEET 7 — "Service Summary"
// ────────────────────────────────────────────────────────────────────────────

export function generateServiceSummaryWorksheet(
	sr: MonthlyShowroomDetailDto,
	monthName: string
): XLSX.WorkSheet {
	const sheetData: (string | number | null)[][] = [];

	sheetData.push(['E6 CAR SPA — SERVICE SUMMARY']);
	sheetData.push([`Showroom: ${sr.showroomName} (${sr.showroomMasterId}) | Period: ${monthName}`]);
	sheetData.push([`Total Services: ${sr.summary.totalServicesPerformed} | Export Date: ${formatDateDisplay(new Date().toISOString())}`]);
	sheetData.push([]);

	// Table Headers
	sheetData.push([
		'Service Category',
		'Service',
		'Vehicles',
		'Quantity',
		'Staff Hours',
		'Share (%)',
		'Volume Meter',
	]);

	if (sr.serviceSummary && sr.serviceSummary.length > 0) {
		sr.serviceSummary.forEach((sv) => {
			sheetData.push([
				sv.serviceCategory || 'General',
				sv.serviceName,
				sv.totalVehicles,
				sv.totalQuantity,
				sv.totalStaffHours,
				`${sv.sharePercentage.toFixed(1)}%`,
				createProgressBar(sv.sharePercentage),
			]);
		});
	} else {
		// Fallback calculation
		const srvMap = new Map<string, { cat: string; name: string; vehicles: number; quantity: number; hours: number }>();
		sr.vehicleWorks.forEach((w) => {
			w.serviceItems.forEach((si) => {
				const cur = srvMap.get(si.workTypeId) || { cat: 'General', name: si.workTypeName, vehicles: 0, quantity: 0, hours: 0 };
				cur.vehicles += w.vehicleQuantity;
				cur.quantity += si.quantity;
				cur.hours += (w.workingHours ?? 9) * 0.5;
				srvMap.set(si.workTypeId, cur);
			});
		});

		const totalS = Math.max(1, sr.summary.totalServicesPerformed);
		if (srvMap.size === 0) {
			sheetData.push(['General', 'No service records found', 0, 0, 0, '0.0%', '']);
		} else {
			srvMap.forEach((v) => {
				const pct = (v.quantity / totalS) * 100;
				sheetData.push([
					v.cat,
					v.name,
					v.vehicles,
					v.quantity,
					Math.round(v.hours * 10) / 10,
					`${pct.toFixed(1)}%`,
					createProgressBar(pct),
				]);
			});
		}
	}

	const ws = XLSX.utils.aoa_to_sheet(sheetData);

	ws['!cols'] = [
		{ wch: 22 }, // Service Category
		{ wch: 28 }, // Service
		{ wch: 16 }, // Vehicles
		{ wch: 16 }, // Quantity
		{ wch: 16 }, // Staff Hours
		{ wch: 16 }, // Share %
		{ wch: 24 }, // Meter
	];

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

	// Sheet 1: Summary
	const wsSummary = generateExecutiveSummaryWorksheet(
		targetShowroom,
		reportData.monthName,
		reportData.fromDate,
		reportData.toDate
	);
	XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

	// Sheet 2: Vehicle Service Details
	const wsDetails = generateVehicleServiceDetailsWorksheet(targetShowroom, reportData.monthName);
	XLSX.utils.book_append_sheet(wb, wsDetails, 'Vehicle Service Details');

	// Sheet 3: Staff Productivity
	const wsStaff = generateStaffProductivityWorksheet(targetShowroom, reportData.monthName);
	XLSX.utils.book_append_sheet(wb, wsStaff, 'Staff Productivity');

	// Sheet 4: Attendance
	const wsAttendance = generateAttendanceWorksheet(targetShowroom, reportData.monthName);
	XLSX.utils.book_append_sheet(wb, wsAttendance, 'Attendance');

	// Sheet 5: Staff Swaps
	const wsSwaps = generateStaffSwapsWorksheet(targetShowroom, reportData.monthName);
	XLSX.utils.book_append_sheet(wb, wsSwaps, 'Staff Swaps');

	// Sheet 6: Vehicle Type Summary
	const wsVehicleType = generateVehicleTypeSummaryWorksheet(targetShowroom, reportData.monthName);
	XLSX.utils.book_append_sheet(wb, wsVehicleType, 'Vehicle Type Summary');

	// Sheet 7: Service Summary
	const wsService = generateServiceSummaryWorksheet(targetShowroom, reportData.monthName);
	XLSX.utils.book_append_sheet(wb, wsService, 'Service Summary');

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
			const fileName = `E6_Car_Spa_${targetShowroom.showroomName.replace(/\s+/g, '_')}_Report_${reportData.monthName.replace(/\s+/g, '_')}.xlsx`;
			XLSX.writeFile(wb, fileName);
			return;
		}
	}

	// Multi-Showroom Mode -> Each showroom receives its own independent 7-Sheet workbook
	if (reportData.showrooms && reportData.showrooms.length > 0) {
		reportData.showrooms.forEach((sr) => {
			const wb = exportSingleShowroomWorkbook(sr, reportData);
			const fileName = `E6_Car_Spa_${sr.showroomName.replace(/\s+/g, '_')}_Report_${reportData.monthName.replace(/\s+/g, '_')}.xlsx`;
			XLSX.writeFile(wb, fileName);
		});
		return;
	}

	// Fallback empty workbook
	const wb = XLSX.utils.book_new();
	const emptyWs = XLSX.utils.aoa_to_sheet([['No showroom data available for export']]);
	XLSX.utils.book_append_sheet(wb, emptyWs, 'No Data');
	const fileName = `E6_Car_Spa_Showroom_Report_${reportData.monthName.replace(/\s+/g, '_')}.xlsx`;
	XLSX.writeFile(wb, fileName);
}

export const exportMonthlyShowroomToExcel = generateAndDownloadMonthlyShowroomReport;
