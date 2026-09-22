import { useState } from 'react';
import {
	Banknote,
	Calendar,
	CreditCard,
	DollarSign,
	FileText,
	Info,
	Layers,
	Receipt,
	Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getStaffList } from '../../lib/api';

export function SalaryPage() {
	const currentYear = new Date().getFullYear();
	const currentMonth = new Date().getMonth() + 1;

	const [selectedYear, setSelectedYear] = useState<number>(currentYear);
	const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);

	// Fetch real staff count from Staff API
	const { data: staffList = [] } = useQuery({
		queryKey: ['staff-list'],
		queryFn: async () => {
			try {
				return await getStaffList();
			} catch {
				return [];
			}
		},
	});

	const months = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];

	return (
		<div className="space-y-6 animate-fade-in pb-12">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-on-surface tracking-tight">
						Staff Salary
					</h1>
					<p className="text-sm text-on-surface-variant mt-1">
						Manage staff salary and payroll information
					</p>
				</div>
			</div>

			{/* Period Selector Bar */}
			<div className="app-card p-4 rounded-2xl shadow-xs">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
							<Calendar className="w-5 h-5" />
						</div>
						<div>
							<h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
								Salary Period
							</h3>
							<p className="text-sm font-bold text-on-surface">
								{months[selectedMonth - 1]} {selectedYear}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3">
						{/* Month Selector */}
						<select
							value={selectedMonth}
							onChange={(e) => setSelectedMonth(Number(e.target.value))}
							className="form-input text-xs w-36 bg-white"
						>
							{months.map((m, idx) => (
								<option key={m} value={idx + 1}>
									{m}
								</option>
							))}
						</select>

						{/* Year Selector */}
						<select
							value={selectedYear}
							onChange={(e) => setSelectedYear(Number(e.target.value))}
							className="form-input text-xs w-28 bg-white"
						>
							{[currentYear - 1, currentYear, currentYear + 1].map((yr) => (
								<option key={yr} value={yr}>
									{yr}
								</option>
							))}
						</select>
					</div>
				</div>
			</div>

			{/* Visual Structure Placeholders for Future Modules */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* 1. Salary Period Overview */}
				<div className="app-card p-4.5 rounded-2xl shadow-xs border border-slate-200/80 bg-white opacity-80">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
							Salary Period
						</span>
						<div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
							<Calendar className="w-4 h-4" />
						</div>
					</div>
					<p className="text-sm font-semibold text-slate-700 mt-2">
						{months[selectedMonth - 1]} Cycle
					</p>
					<p className="text-xs text-slate-400 mt-1">Pending backend enablement</p>
				</div>

				{/* 2. Staff Payroll Structure */}
				<div className="app-card p-4.5 rounded-2xl shadow-xs border border-slate-200/80 bg-white opacity-80">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
							Staff Payroll
						</span>
						<div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
							<Banknote className="w-4 h-4" />
						</div>
					</div>
					<p className="text-sm font-semibold text-slate-700 mt-2">
						Salary Structure
					</p>
					<p className="text-xs text-slate-400 mt-1">{staffList.length} staff eligible</p>
				</div>

				{/* 3. Advance Deductions Structure */}
				<div className="app-card p-4.5 rounded-2xl shadow-xs border border-slate-200/80 bg-white opacity-80">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
							Advance Deductions
						</span>
						<div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
							<Receipt className="w-4 h-4" />
						</div>
					</div>
					<p className="text-sm font-semibold text-slate-700 mt-2">
						Recovery Integration
					</p>
					<p className="text-xs text-slate-400 mt-1">Linked to Staff Advances</p>
				</div>

				{/* 4. Salary Payments Structure */}
				<div className="app-card p-4.5 rounded-2xl shadow-xs border border-slate-200/80 bg-white opacity-80">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
							Salary Payments
						</span>
						<div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
							<CreditCard className="w-4 h-4" />
						</div>
					</div>
					<p className="text-sm font-semibold text-slate-700 mt-2">
						Disbursement Status
					</p>
					<p className="text-xs text-slate-400 mt-1">Pending integration</p>
				</div>
			</div>

			{/* Informational Preparation Notice (No Fake Payroll Data) */}
			<div className="app-card p-8 rounded-2xl shadow-xs border border-blue-100 bg-gradient-to-br from-blue-50/50 via-slate-50/30 to-transparent">
				<div className="max-w-xl mx-auto text-center space-y-4">
					<div className="w-14 h-14 rounded-2xl bg-blue-100/80 text-blue-700 flex items-center justify-center mx-auto shadow-xs">
						<DollarSign className="w-7 h-7" />
					</div>

					<div>
						<h2 className="text-lg font-bold text-slate-900 tracking-tight">
							Staff Salary Management
						</h2>
						<p className="text-xs text-slate-600 mt-2 leading-relaxed">
							Payroll calculation and salary processing will be connected when the Staff Salary backend is introduced.
						</p>
					</div>

					<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium">
						<Info className="w-3.5 h-3.5 text-blue-600" />
						<span>UI Shell Prepared for Future Backend Integration</span>
					</div>

					<div className="pt-4 border-t border-slate-200/60 flex items-center justify-center gap-6 text-xs text-slate-500">
						<div className="flex items-center gap-1.5">
							<Users className="w-3.5 h-3.5 text-slate-400" />
							<span>{staffList.length} Total Staff in Directory</span>
						</div>
						<div className="flex items-center gap-1.5">
							<FileText className="w-3.5 h-3.5 text-slate-400" />
							<span>Advance Records Ready for Deduction Mapping</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default SalaryPage;
