import { useState } from 'react';
import {
	Calendar,
	Search,
	Clock,
	Users,
	Info,
	ChevronLeft,
	ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { getStaffList } from '../../lib/api';

export function AttendancePage() {
	const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
	const [searchQuery, setSearchQuery] = useState('');

	// Load real staff list for reference
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

	const handlePrevDay = () => {
		const d = new Date(selectedDate);
		d.setDate(d.getDate() - 1);
		setSelectedDate(d.toISOString().split('T')[0]);
	};

	const handleNextDay = () => {
		const d = new Date(selectedDate);
		d.setDate(d.getDate() + 1);
		setSelectedDate(d.toISOString().split('T')[0]);
	};

	const handleToday = () => {
		setSelectedDate(new Date().toISOString().split('T')[0]);
	};

	const formattedSelectedDate = new Date(selectedDate).toLocaleDateString('en-IN', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	});

	return (
		<div className="space-y-6 animate-fade-in pb-12">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-on-surface tracking-tight">
						Staff Attendance
					</h1>
					<p className="text-sm text-on-surface-variant mt-1">
						Track daily staff attendance and attendance history
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="secondary"
						size="sm"
						onClick={handleToday}
					>
						Today
					</Button>
				</div>
			</div>

			{/* Date Navigation & Controls Bar */}
			<div className="app-card p-4 rounded-2xl shadow-xs">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					{/* Date Navigator */}
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handlePrevDay}
							className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-low text-on-surface-variant transition-colors cursor-pointer"
							title="Previous Day"
						>
							<ChevronLeft className="w-4 h-4" />
						</button>

						<div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest">
							<Calendar className="w-4 h-4 text-blue-600" />
							<input
								type="date"
								value={selectedDate}
								onChange={(e) => setSelectedDate(e.target.value)}
								className="text-xs font-semibold text-on-surface bg-transparent border-none focus:outline-none cursor-pointer"
							/>
						</div>

						<button
							type="button"
							onClick={handleNextDay}
							className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-low text-on-surface-variant transition-colors cursor-pointer"
							title="Next Day"
						>
							<ChevronRight className="w-4 h-4" />
						</button>

						<span className="text-xs font-medium text-on-surface-variant hidden md:inline ml-2">
							{formattedSelectedDate}
						</span>
					</div>

					{/* Search Staff */}
					<div className="flex items-center gap-3">
						<div className="relative w-64">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
							<input
								type="text"
								placeholder="Filter staff by name or role..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="form-input pl-9 pr-4 py-1.5 w-full text-xs"
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Informational Preparation Banner (No Fake Data) */}
			<div className="app-card p-8 rounded-2xl shadow-xs border border-blue-100 bg-gradient-to-br from-blue-50/50 via-slate-50/30 to-transparent">
				<div className="max-w-xl mx-auto text-center space-y-4">
					<div className="w-14 h-14 rounded-2xl bg-blue-100/80 text-blue-700 flex items-center justify-center mx-auto shadow-xs">
						<Clock className="w-7 h-7" />
					</div>

					<div>
						<h2 className="text-lg font-bold text-slate-900 tracking-tight">
							Staff Attendance Tracking
						</h2>
						<p className="text-xs text-slate-600 mt-2 leading-relaxed">
							Attendance records and daily staff check-in management will be available once the Staff Attendance backend is enabled.
						</p>
					</div>

					<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium">
						<Info className="w-3.5 h-3.5 text-blue-600" />
						<span>UI Shell Prepared for Future Backend Integration</span>
					</div>

					<div className="pt-4 border-t border-slate-200/60 flex items-center justify-center gap-6 text-xs text-slate-500">
						<div className="flex items-center gap-1.5">
							<Users className="w-3.5 h-3.5 text-slate-400" />
							<span>{staffList.length} Active Staff Registered in Directory</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default AttendancePage;
