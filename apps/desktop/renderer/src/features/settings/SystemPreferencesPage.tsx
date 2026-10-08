import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
	Calendar,
	Printer,
	RefreshCw,
	Save,
	CheckCircle2,
	AlertCircle,
	Laptop,
	ShieldCheck,
	Keyboard,
} from 'lucide-react';
import { PoweredByTrovo } from '../../components/shared/PoweredByTrovo';
import { useAppStore } from '../../stores/app';
import { useAuth } from '../auth';
import { AppearanceCard } from './AppearanceCard';
import { LoginImageCard } from './LoginImageCard';
import {
	getSystemPreferences,
	updateSystemPreferences,
	type SystemPreferencesDto,
} from '../../lib/api';

export interface SystemPreferences {
	dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
	timeFormat: '12h' | '24h';
	currencySymbol: '₹';
	decimalPrecision: number;
	defaultPrintCopies: number;
	autoPrintReceipt: boolean;
	refreshInterval: number; // in seconds, 0 = manual
}

export const SYSTEM_PREFERENCES_STORAGE_KEY = 'e6_system_preferences';

export const DEFAULT_SYSTEM_PREFERENCES: SystemPreferences = {
	dateFormat: 'DD/MM/YYYY',
	timeFormat: '12h',
	currencySymbol: '₹',
	decimalPrecision: 2,
	defaultPrintCopies: 1,
	autoPrintReceipt: true,
	refreshInterval: 30,
};

export function getStoredPreferences(): SystemPreferences {
	if (typeof localStorage === 'undefined') return DEFAULT_SYSTEM_PREFERENCES;
	try {
		const raw = localStorage.getItem(SYSTEM_PREFERENCES_STORAGE_KEY);
		if (!raw) return DEFAULT_SYSTEM_PREFERENCES;
		const parsed = JSON.parse(raw);
		return {
			...DEFAULT_SYSTEM_PREFERENCES,
			...parsed,
			currencySymbol: '₹', // Fallback/migrate to INR strictly
		};
	} catch {
		return DEFAULT_SYSTEM_PREFERENCES;
	}
}

export function saveStoredPreferences(prefs: SystemPreferences): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(SYSTEM_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// Ignore storage quota errors
	}
}

export function SystemPreferencesPage() {
	const isElectron = useAppStore((s) => s.isElectron);
	const queryClient = useQueryClient();
	const { user, isAuthenticated, token, hasPermission } = useAuth();

	const [preferences, setPreferences] = useState<SystemPreferences>(getStoredPreferences);
	const [tab, setTab] = useState<'general' | 'colours'>('general');
	const [savedMsg, setSavedMsg] = useState<string | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	// Fetch authoritative preferences from server
	const { data: serverPrefs, isLoading, isError } = useQuery<SystemPreferencesDto>({
		queryKey: ['system-preferences'],
		queryFn: getSystemPreferences,
		enabled: Boolean(isAuthenticated && token && hasPermission('settings.view')),
	});

	// Synchronize server data when loaded
	useEffect(() => {
		if (serverPrefs) {
			const loaded: SystemPreferences = {
				dateFormat: serverPrefs.dateFormat,
				timeFormat: serverPrefs.timeFormat,
				currencySymbol: serverPrefs.currencySymbol,
				decimalPrecision: serverPrefs.decimalPrecision ?? 2,
				defaultPrintCopies: serverPrefs.defaultPrintCopies ?? 1,
				autoPrintReceipt: serverPrefs.autoPrintReceipt ?? true,
				refreshInterval: serverPrefs.refreshInterval ?? 30,
			};
			setPreferences(loaded);
			saveStoredPreferences(loaded);
		}
	}, [serverPrefs]);

	const saveMutation = useMutation({
		mutationFn: async (updated: SystemPreferences) => {
			return await updateSystemPreferences({
				dateFormat: updated.dateFormat,
				timeFormat: updated.timeFormat,
				currencySymbol: updated.currencySymbol,
				decimalPrecision: updated.decimalPrecision,
				defaultPrintCopies: updated.defaultPrintCopies,
				autoPrintReceipt: updated.autoPrintReceipt,
				refreshInterval: updated.refreshInterval,
			});
		},
		onSuccess: (data) => {
			const saved: SystemPreferences = {
				dateFormat: data.dateFormat,
				timeFormat: data.timeFormat,
				currencySymbol: data.currencySymbol,
				decimalPrecision: data.decimalPrecision ?? 2,
				defaultPrintCopies: data.defaultPrintCopies ?? 1,
				autoPrintReceipt: data.autoPrintReceipt ?? true,
				refreshInterval: data.refreshInterval ?? 30,
			};
			setPreferences(saved);
			saveStoredPreferences(saved);
			queryClient.setQueryData(['system-preferences'], data);
			setErrorMsg(null);
			setSavedMsg('System preferences saved successfully.');
			setTimeout(() => setSavedMsg(null), 3000);
		},
		onError: (err: Error) => {
			// Save to local cache as offline fallback
			saveStoredPreferences(preferences);
			setErrorMsg(err.message || 'Failed to save system preferences to server.');
			setTimeout(() => setErrorMsg(null), 5000);
		},
	});

	const handleSave = (e: React.FormEvent) => {
		e.preventDefault();
		setErrorMsg(null);
		saveMutation.mutate(preferences);
	};

	const handleReset = () => {
		setErrorMsg(null);
		saveMutation.mutate(DEFAULT_SYSTEM_PREFERENCES, {
			onSuccess: () => {
				setSavedMsg('Preferences reset to standard defaults.');
				setTimeout(() => setSavedMsg(null), 3000);
			},
		});
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

				{tab === 'general' && (
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handleReset}
						disabled={saveMutation.isPending}
						className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
					>
						Reset Defaults
					</button>
					<button
						type="submit"
						form="system-preferences-form"
						disabled={saveMutation.isPending}
						className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
					>
						<Save className="w-4 h-4" />
						{saveMutation.isPending ? 'Saving...' : 'Save Preferences'}
					</button>
				</div>
				)}
			</div>

			{/* Tabs */}
			<div role="tablist" aria-label="System preferences sections" className="flex gap-1 border-b border-slate-200">
				{([
					['general', 'General'],
					['colours', 'App colours'],
				] as const).map(([id, label]) => (
					<button
						key={id}
						type="button"
						role="tab"
						aria-selected={tab === id}
						onClick={() => setTab(id)}
						className={`px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
							tab === id
								? 'border-blue-600 text-blue-700'
								: 'border-transparent text-slate-500 hover:text-slate-800'
						}`}
					>
						{label}
					</button>
				))}
			</div>

			{/* Loading banner */}
			{isLoading && (
				<div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
					<RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
					Loading canonical system preferences from server...
				</div>
			)}

			{/* Offline Fallback Warning banner */}
			{isError && (
				<div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
					<AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
					Server currently unavailable. Displaying local cached preferences.
				</div>
			)}

			{/* Notification Toast */}
			{savedMsg && (
				<div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
					<CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
					{savedMsg}
				</div>
			)}

			{/* Error Toast */}
			{errorMsg && (
				<div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
					<AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
					{errorMsg}
				</div>
			)}

			{tab === 'colours' && (
				<div className="animate-in fade-in duration-150">
					<AppearanceCard
						canEdit={Boolean(user?.isOwner || hasPermission('settings.business'))}
						below={<LoginImageCard canEdit={Boolean(user?.isOwner || hasPermission('settings.business'))} />}
					/>
				</div>
			)}

			{tab === 'general' && (
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

							<div>
								<label htmlFor="pref-currency-symbol" className="block text-xs font-semibold text-slate-700 mb-1.5">
									Default Currency Symbol
								</label>
								<select
									id="pref-currency-symbol"
									value={preferences.currencySymbol}
									onChange={() =>
										setPreferences((p) => ({
											...p,
											currencySymbol: '₹',
										}))
									}
									className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
								>
									<option value="₹">₹ — Indian Rupee (INR)</option>
								</select>
								<p className="text-[11px] text-slate-400 mt-1">
									Used for monetary figures, customer invoices, and financial reports across all workspaces.
								</p>
							</div>

							<div>
								<label htmlFor="pref-decimal-precision" className="block text-xs font-semibold text-slate-700 mb-1.5">
									Decimal Precision
								</label>
								<select
									id="pref-decimal-precision"
									value={preferences.decimalPrecision}
									onChange={(e) =>
										setPreferences((p) => ({
											...p,
											decimalPrecision: Number(e.target.value),
										}))
									}
									className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
								>
									<option value={2}>2 Decimals (.00)</option>
									<option value={0}>0 Decimals (Whole numbers)</option>
								</select>
								<p className="text-[11px] text-slate-400 mt-1">
									Determines fractional decimal display on financial totals and print receipts.
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
									<label htmlFor="pref-auto-print" className="block text-xs font-semibold text-slate-700 cursor-pointer">
										Auto-Print on Settlement
									</label>
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
									className="h-4 w-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
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
								<span className="font-semibold text-slate-800">Server Synchronized + SQLite</span>
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
								<span className="text-slate-600">Billing</span>
								<kbd className="px-2 py-0.5 bg-white rounded-md border border-slate-200 font-mono text-[10px] text-slate-700">Alt + 1</kbd>
							</div>
							<div className="flex justify-between items-center py-1">
								<span className="text-slate-600">Staff</span>
								<kbd className="px-2 py-0.5 bg-white rounded-md border border-slate-200 font-mono text-[10px] text-slate-700">Alt + 2</kbd>
							</div>
							<div className="flex justify-between items-center py-1">
								<span className="text-slate-600">Showroom</span>
								<kbd className="px-2 py-0.5 bg-white rounded-md border border-slate-200 font-mono text-[10px] text-slate-700">Alt + 3</kbd>
							</div>
							<div className="flex justify-between items-center py-1">
								<span className="text-slate-600">Reports</span>
								<kbd className="px-2 py-0.5 bg-white rounded-md border border-slate-200 font-mono text-[10px] text-slate-700">Alt + 4</kbd>
							</div>
							<div className="flex justify-between items-center py-1">
								<span className="text-slate-600">Settings</span>
								<kbd className="px-2 py-0.5 bg-white rounded-md border border-slate-200 font-mono text-[10px] text-slate-700">Alt + 5</kbd>
							</div>
						</div>
					</div>

					<div className="text-center pt-2">
						<PoweredByTrovo />
					</div>
				</div>
			</div>
			)}
		</div>
	);
}

export default SystemPreferencesPage;
