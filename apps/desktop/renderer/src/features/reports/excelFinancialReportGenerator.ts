import ExcelJS from 'exceljs';
import { reportCreator, reportFilePrefix, reportTitle } from '../../lib/documentBranding';
import type { SheetSpec } from './financialReports';

const HEADER_FILL = 'FF0B5ED7';
const TITLE_FILL = 'FF0B3A6E';
const TOTAL_FILL = 'FFEAF2FF';
const MONEY = '"₹"#,##0.00;[Red]-"₹"#,##0.00;"₹"0.00';

/** A one-sheet workbook for a financial report, styled like the other report workbooks. */
/** Titles and file names carry the signed-in company's name, taken from its saved business profile. */
export function createFinancialWorkbook(spec: SheetSpec): ExcelJS.Workbook {
	const wb = new ExcelJS.Workbook();
	wb.creator = reportCreator();
	wb.lastModifiedBy = reportCreator();
	wb.created = new Date();
	wb.modified = new Date();

	const ws = wb.addWorksheet(spec.sheetName, { views: [{ state: 'frozen', ySplit: 4 }] });
	const columns = spec.headers.length;
	const money = new Set(spec.moneyColumns ?? []);
	spec.widths.forEach((w, i) => {
		ws.getColumn(i + 1).width = w;
	});

	const title = ws.getRow(1);
	ws.mergeCells(1, 1, 1, columns);
	title.getCell(1).value = reportTitle(spec.title);
	title.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
	title.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_FILL } };
	title.height = 30;
	title.alignment = { vertical: 'middle' };

	ws.mergeCells(2, 1, 2, columns);
	ws.getRow(2).getCell(1).value = spec.subtitle;
	ws.getRow(2).getCell(1).font = { italic: true, color: { argb: 'FF475569' } };

	const header = ws.getRow(4);
	spec.headers.forEach((text, i) => {
		const cell = header.getCell(i + 1);
		cell.value = text;
		cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
		cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
	});
	header.height = 22;

	let rowIndex = 5;
	for (const values of spec.rows) {
		const row = ws.getRow(rowIndex++);
		values.forEach((v, i) => {
			const cell = row.getCell(i + 1);
			cell.value = v;
			if (typeof v === 'number') {
				cell.numFmt = money.has(i) ? MONEY : '#,##0';
				cell.alignment = { horizontal: 'right' };
			}
		});
	}

	if (spec.totals) {
		const row = ws.getRow(rowIndex++);
		spec.totals.forEach((v, i) => {
			const cell = row.getCell(i + 1);
			cell.value = v;
			cell.font = { bold: true };
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };
			if (typeof v === 'number') {
				cell.numFmt = money.has(i) ? MONEY : '#,##0';
				cell.alignment = { horizontal: 'right' };
			}
		});
		row.height = 22;
	}

	return wb;
}

export function financialReportFileName(spec: SheetSpec, fromDate: string, toDate: string): string {
	const base = spec.sheetName.replace(/\s+/g, '_');
	return `${reportFilePrefix()}${base}_Report_${fromDate}_to_${toDate}.xlsx`;
}

/** Builds the workbook and hands it to the browser as a download. */
export async function downloadFinancialReport(
	spec: SheetSpec,
	fromDate: string,
	toDate: string,
): Promise<string> {
	const wb = createFinancialWorkbook(spec);
	const fileName = financialReportFileName(spec, fromDate, toDate);
	const buffer = await wb.xlsx.writeBuffer();
	const blob = new Blob([buffer], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	});
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.URL.revokeObjectURL(url);
	return fileName;
}
