import { useState } from 'react';
import {
	Calendar,
	Printer,
	RefreshCw,
	Save,
	CheckCircle2,
	Laptop,
	ShieldCheck,
	Keyboard,
} from 'lucide-react';
import { PoweredByTrovo } from '../../components/shared/PoweredByTrovo';
import { useAppStore } from '../../stores/app';

export interface SystemPreferences {
	dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
	timeFormat: '12h' | '24h';
	currencySymbol: '₹' | '$' | '€';
	defaultPrintCopies: number;
	autoPrintReceipt: boolean;
	refreshInterval: number; // in seconds, 0 = manual
}

export const SYSTEM_PREFERENCES_STORAGE_KEY = 'e6_system_preferences';

export const DEFAULT_SYSTEM_PREFERENCES: SystemPreferences = {
	dateFormat: 'DD/MM/YYYY',
	timeFormat: '12h',
	currencySymbol: '₹',
	defaultPrintCopies: 1,
	autoPrintReceipt: true,
	refreshInterval: 30,
};

export function getStoredPreferences(): SystemPreferences {
	if (typeof localStorage === 'undefined') return DEFAULT_SYSTEM_PREFERENCES;
	try {
		const raw = localStorage.getItem(SYSTEM_PREFERENCES_STORAGE_KEY);
		if (!raw) return DEFAULT_SYSTEM_PREFERENCES;
		return { ...DEFAULT_SYSTEM_PREFERENCES, ...JSON.parse(raw) };
	} catch {
		return DEFAULT_SYSTEM_PREFERENCES;
	}
}

export function SystemPreferencesPage() {
	const isElectron = useAppStore((s) => s.isElectron);

	const [preferences, setPreferences] = useState<SystemPreferences>(getStoredPreferences);
	const [saving, setSaving] = useState(false);
	const [savedMsg, setSavedMsg] = useState<string | null>(null);

	const handleSave = (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		try {
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(SYSTEM_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
			}
			setSavedMsg('System preferences saved successfully.');
			setTimeout(() => setSavedMsg(null), 3000);
		} finally {
			setSaving(false);
		}
	};

	const handleReset = () => {
		setPreferences(DEFAULT_SYSTEM_PREFERENCES);
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(SYSTEM_PREFERENCES_STORAGE_KEY, JSON.stringify(DEFAULT_SYSTEM_PREFERENCES));
		}
		setSavedMsg('Preferences reset to standard defaults.');
		setTimeout(() => setSavedMsg(null), 3000);
	};

	return (
		<div className="space-y-6 w-full">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
						System Preferences
					</h1>
					<p className="text-xs text-slate-500 mt-0.5">
						Manage application preferences, formatting defaults, and system behavior
					</p>
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handleReset}
						className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-all cursor-pointer"
					>
						Reset Defaults
					</button>
					<button
						type="submit"
						form="system-preferences-form"
						disabled={saving}
						className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
					>
						<Save className="w-4 h-4" />
						{saving ? 'Saving...' : 'Save Preferences'}
					</button>
				</div>
			</div>

			{/* Notification Toast */}
			{savedMsg && (
				<div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
					<CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
					{savedMsg}
				</div>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
				{/* Main Preferences Form */}
				<form
					id="system-preferences-form"
					onSubmit={handleSave}
					className="lg:col-span-2 space-y-6"
				>
					{/* Regional & Formatting */}
					<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
						<div className="flex items-center gap-2 pb-3 border-b border-slate-100">
							<Calendar className="w-5 h-5 text-blue-600" />
							<h2 className="text-base font-bold text-slate-800">Date & Formatting</h2>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label htmlFor="pref-date-format" className="block text-xs font-semibold text-slate-700 mb-1.5">
									Date Display Format
								</label>
								<select
									id="pref-date-format"
									value={preferences.dateFormat}
									onChange={(e) =>
										setPreferences((p) => ({
											...p,
											dateFormat: e.target.value as SystemPreferences['dateFormat'],
										}))
									}
									className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
								>
									<option value="DD/MM/YYYY">DD/MM/YYYY (Indian Standard)</option>
									<option value="MM/DD/YYYY">MM/DD/YYYY (US Standard)</option>
									<option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
								</select>
							</div>

							<div>
								<label htmlFor="pref-time-format" className="block text-xs font-semibold text-slate-700 mb-1.5">
									Time Format
								</label>
								<select
									id="pref-time-format"
									value={preferences.timeFormat}
									onChange={(e) =>
										setPreferences((p) => ({
											...p,
											timeFormat: e.target.value as SystemPreferences['timeFormat'],
										}))
									}
									className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
								>
									<option value="12h">12-Hour (e.g. 02:30 PM)</option>
									<option value="24h">24-Hour (e.g. 14:30)</option>
								</select>
							</div>

							<div className="sm:col-span-2">
								<label htmlFor="pref-currency-symbol" className="block text-xs font-semibold text-slate-700 mb-1.5">
									Default Currency Symbol
								</label>
								<select
									id="pref-currency-symbol"
									value={preferences.currencySymbol}
									onChange={(e) =>
										setPreferences((p) => ({
											...p,
											currencySymbol: e.target.value as SystemPreferences['currencySymbol'],
										}))
									}
									className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
								>
									<option value="₹">₹ — Indian Rupee (Default)</option>
									<option value="$">$ — US Dollar</option>
									<option value="€">€ — Euro</option>
								</select>
								<p className="text-[11px] text-slate-400 mt-1">
									Used for monetary figures, customer invoices, and financial reports across all workspaces.
								</p>
							</div>
						</div>
					</div>

					{/* Document & Printing Defaults */}
					<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
						<div className="flex items-center gap-2 pb-3 border-b border-slate-100">
							<Printer className="w-5 h-5 text-blue-600" />
							<h2 className="text-base font-bold text-slate-800">Print & Document Defaults</h2>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label htmlFor="pref-print-copies" className="block text-xs font-semibold text-slate-700 mb-1.5">
									Default Invoice Print Copies
								</label>
								<select
									id="pref-print-copies"
									value={preferences.defaultPrintCopies}
									onChange={(e) =>
										setPreferences((p) => ({
											...p,
											defaultPrintCopies: Number(e.target.value),
										}))
									}
									className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
								>
									<option value={1}>1 Copy (Customer Original)</option>
									<option value={2}>2 Copies (Customer + Office Copy)</option>
									<option value={3}>3 Copies (Customer + Office + Gate Pass)</option>
								</select>
							</div>

							<div className="flex items-center justify-between sm:pt-6">
								<div>
									<span className="block text-xs font-semibold text-slate-700">Auto-Print on Settlement</span>
									<span className="text-[11px] text-slate-400">Trigger print modal when balance hits ₹0</span>
								</div>
								<input
									type="checkbox"
									id="pref-auto-print"
									checked={preferences.autoPrintReceipt}
									onChange={(e) =>
										setPreferences((p) => ({
											...p,
											autoPrintReceipt: e.target.checked,
										}))
									}
									className="h-4 w-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
								/>
							</div>
						</div>
					</div>

					{/* Operational & Live Behavior */}
					<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
						<div className="flex items-center gap-2 pb-3 border-b border-slate-100">
							<RefreshCw className="w-5 h-5 text-blue-600" />
							<h2 className="text-base font-bold text-slate-800">Operational Auto-Refresh</h2>
						</div>

						<div>
							<label htmlFor="pref-refresh-interval" className="block text-xs font-semibold text-slate-700 mb-1.5">
								Live Operational Data Refresh Rate
							</label>
							<select
								id="pref-refresh-interval"
								value={preferences.refreshInterval}
								onChange={(e) =>
									setPreferences((p) => ({
										...p,
										refreshInterval: Number(e.target.value),
									}))
								}
								className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
							>
								<option value={15}>15 Seconds (Rapid update)</option>
								<option value={30}>30 Seconds (Recommended)</option>
								<option value={60}>60 Seconds (Low network traffic)</option>
								<option value={0}>Manual Refresh Only</option>
							</select>
							<p className="text-[11px] text-slate-400 mt-1">
								Governs automatic polling frequency for live job-card status boards and showroom queues.
							</p>
						</div>
					</div>
				</form>

				{/* Right Sidebar Column */}
				<div className="space-y-6">
					{/* System Environment Card */}
					<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
						<div className="flex items-center gap-2 pb-3 border-b border-slate-100">
							<div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
								<Laptop className="w-4 h-4" />
							</div>
							<div>
								<h3 className="text-xs font-bold text-slate-800">System Environment</h3>
								<p className="text-[11px] text-slate-500">Desktop Architecture</p>
							</div>
						</div>

						<div className="space-y-3 text-xs">
							<div className="flex justify-between py-1 border-b border-slate-100">
								<span className="text-slate-500">Client Runtime</span>
								<span className="font-semibold text-slate-800">
									{isElectron ? 'Electron Desktop' : 'Web Shell (Vite)'}
								</span>
							</div>
							<div className="flex justify-between py-1 border-b border-slate-100">
								<span className="text-slate-500">Suite Version</span>
								<span className="font-mono font-semibold text-slate-800">v2.4.0 Production</span>
							</div>
							<div className="flex justify-between py-1 border-b border-slate-100">
								<span className="text-slate-500">Storage Layer</span>
								<span className="font-semibold text-slate-800">SQLite + Singleton Config</span>
							</div>
							<div className="flex justify-between py-1">
								<span className="text-slate-500">Print Foundation</span>
								<span className="font-semibold text-emerald-700 flex items-center gap-1">
									<ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Active
								</span>
							</div>
						</div>
					</div>

					{/* Suite Keyboard Shortcuts */}
					<div className="bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl border border-slate-200 p-5 space-y-3">
						<h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
							<Keyboard className="w-4 h-4 text-blue-600" />
							<span>Suite Launcher Shortcuts</span>
						</h4>

						<div className="space-y-2 text-[11px]">
							<div className="flex justify-between items-center py-1">
								<span className="text-slate-600">E6 Billing</span>
								<kbd className="px-2 py-0.5 bg-white rounded-md border border-slate-200 font-mono text-[10px] text-slate-700">Alt + 1</kbd>
							</div>
							<div className="flex justify-between items-center py-1">
								<span className="text-slate-600">E6 Staff</span>
								<kbd className="px-2 py-0.5 bg-white rounded-md border border-slate-200 font-mono text-[10px] text-slate-700">Alt + 2</kbd>
							</div>
							<div className="flex justify-between items-center py-1">
								<span className="text-slate-600">E6 Showroom</span>
								<kbd className="px-2 py-0.5 bg-white rounded-md border border-slate-200 font-mono text-[10px] text-slate-700">Alt + 3</kbd>
							</div>
							<div className="flex justify-between items-center py-1">
								<span className="text-slate-600">E6 Reports</span>
								<kbd className="px-2 py-0.5 bg-white rounded-md border border-slate-200 font-mono text-[10px] text-slate-700">Alt + 4</kbd>
							</div>
							<div className="flex justify-between items-center py-1">
								<span className="text-slate-600">E6 Settings</span>
								<kbd className="px-2 py-0.5 bg-white rounded-md border border-slate-200 font-mono text-[10px] text-slate-700">Alt + 5</kbd>
							</div>
						</div>
					</div>

					<div className="text-center pt-2">
						<PoweredByTrovo />
					</div>
				</div>
			</div>
		</div>
	);
}

export default SystemPreferencesPage;
