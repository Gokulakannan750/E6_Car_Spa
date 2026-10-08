import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2, Palette, RotateCcw, Save } from 'lucide-react';
import { resolveLogoUrl, updateAppearance } from '../../lib/api';
import {
	COLOR_PRESETS,
	DEFAULT_APP_COLOR,
	DEFAULT_SIDEBAR_COLOR,
	applyTheme,
	contrastWithWhite,
	isValidColor,
} from '../../lib/theme';
import { DEFAULT_DOCUMENT_ACCENT } from '../../lib/documentBranding';
import { ColourPreview } from './ColourPreview';
import { BUSINESS_PROFILE_QUERY_KEY, useBusinessProfile } from './hooks/useBusinessProfile';

interface ColourRowProps {
	label: string;
	description: string;
	value: string;
	fallback: string;
	disabled: boolean;
	onChange: (hex: string) => void;
}

/** A colour is "unusable" for white text when the contrast is below 3:1, e.g. pale yellow. */
function ColourRow({ label, description, value, fallback, disabled, onChange }: ColourRowProps) {
	const shown = isValidColor(value) ? value.trim() : fallback;
	const invalid = value.trim() !== '' && !isValidColor(value);
	const tooLight = !invalid && contrastWithWhite(shown) < 3;

	return (
		<div className="py-4 first:pt-0 last:pb-0 border-b last:border-b-0 border-slate-100">
			<div className="flex items-start justify-between gap-4">
				<div>
					<p className="text-xs font-bold text-slate-800">{label}</p>
					<p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
				</div>
				<div
					className="h-9 w-16 rounded-lg border border-slate-200 shadow-xs shrink-0"
					style={{ backgroundColor: shown }}
					aria-hidden
				/>
			</div>

			<div className="flex flex-wrap items-center gap-1.5 mt-3">
				{COLOR_PRESETS.map((preset) => (
					<button
						key={preset.hex}
						type="button"
						title={preset.name}
						aria-label={`${label}: ${preset.name}`}
						disabled={disabled}
						onClick={() => onChange(preset.hex)}
						className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
							shown.toUpperCase() === preset.hex ? 'border-slate-800' : 'border-white ring-1 ring-slate-200'
						}`}
						style={{ backgroundColor: preset.hex }}
					/>
				))}
				<input
					type="color"
					aria-label={`Pick ${label.toLowerCase()}`}
					value={shown}
					disabled={disabled}
					onChange={(e) => onChange(e.target.value.toUpperCase())}
					className="h-7 w-10 rounded-md border border-slate-200 bg-white p-0.5 cursor-pointer disabled:cursor-not-allowed"
				/>
				<input
					type="text"
					aria-label={`${label} code`}
					value={value}
					disabled={disabled}
					maxLength={7}
					placeholder={fallback}
					onChange={(e) => onChange(e.target.value.toUpperCase())}
					className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
				/>
				{value && !disabled && (
					<button
						type="button"
						onClick={() => onChange('')}
						className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 underline cursor-pointer"
					>
						<RotateCcw className="w-3 h-3" /> Use default
					</button>
				)}
			</div>

			{invalid && <p className="text-[11px] text-rose-600 mt-1.5">Enter a colour code like #1E293B.</p>}
			{tooLight && (
				<p className="text-[11px] text-amber-700 mt-1.5">
					This colour is quite light, so white text on it may be hard to read. A darker colour works better.
				</p>
			)}
		</div>
	);
}

/** System Preferences card where a company chooses its own app, sidebar/login and document colours. */
/** `below` is shown directly under the colours card, in the same column (the preview stays on the right). */
export function AppearanceCard({ canEdit, below }: { canEdit: boolean; below?: ReactNode }) {
	const queryClient = useQueryClient();
	const { profile } = useBusinessProfile();

	const saved = useRef({ app: '', side: '', doc: '' });
	const [appColor, setAppColor] = useState('');
	const [sidebarColor, setSidebarColor] = useState('');
	const [documentColor, setDocumentColor] = useState('');
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

	// Load the saved colours once the profile arrives (and again after each save).
	useEffect(() => {
		if (!profile) return;
		saved.current = {
			app: profile.appColor ?? '',
			side: profile.sidebarColor ?? '',
			doc: profile.brandColor ?? '',
		};
		setAppColor(saved.current.app);
		setSidebarColor(saved.current.side);
		setDocumentColor(saved.current.doc);
	}, [profile?.appColor, profile?.sidebarColor, profile?.brandColor]); // eslint-disable-line react-hooks/exhaustive-deps

	// Picking a colour previews it across the app straight away.
	useEffect(() => {
		applyTheme({
			appColor: isValidColor(appColor) ? appColor : null,
			sidebarColor: isValidColor(sidebarColor) ? sidebarColor : null,
		});
	}, [appColor, sidebarColor]);

	// Leaving the page without saving puts the saved colours back.
	useEffect(() => {
		return () => {
			applyTheme({ appColor: saved.current.app || null, sidebarColor: saved.current.side || null });
		};
	}, []);

	const dirty =
		appColor !== saved.current.app || sidebarColor !== saved.current.side || documentColor !== saved.current.doc;
	const anyInvalid = [appColor, sidebarColor, documentColor].some((c) => c.trim() !== '' && !isValidColor(c));

	async function handleSave() {
		setSaving(true);
		setMessage(null);
		try {
			const updated = await updateAppearance({ appColor, sidebarColor, brandColor: documentColor });
			queryClient.setQueryData(BUSINESS_PROFILE_QUERY_KEY, updated);
			setMessage({ kind: 'ok', text: 'Colours saved. They now apply to everyone using this company.' });
		} catch (err) {
			setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to save colours' });
		} finally {
			setSaving(false);
		}
	}

	function handleDiscard() {
		setAppColor(saved.current.app);
		setSidebarColor(saved.current.side);
		setDocumentColor(saved.current.doc);
		setMessage(null);
	}

	return (
		<div className="grid grid-cols-1 xl:grid-cols-[minmax(0,640px)_minmax(0,1fr)] gap-6 items-start">
		<div className="space-y-6 min-w-0">
		<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
			<div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
				<div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
					<Palette className="w-4 h-4" />
				</div>
				<div>
					<h3 className="text-sm font-bold text-slate-800">App colours</h3>
					<p className="text-[11px] text-slate-500">Make the app, login page and documents match your company.</p>
				</div>
			</div>

			<ColourRow
				label="App colour"
				description="Buttons, links and highlights across the app."
				value={appColor}
				fallback={DEFAULT_APP_COLOR}
				disabled={!canEdit || saving}
				onChange={setAppColor}
			/>
			<ColourRow
				label="Sidebar and login page"
				description="The menu on the left and the sign-in screen."
				value={sidebarColor}
				fallback={DEFAULT_SIDEBAR_COLOR}
				disabled={!canEdit || saving}
				onChange={setSidebarColor}
			/>
			<ColourRow
				label="Invoices and job cards"
				description="Headings and accents on printed and PDF invoices and job cards."
				value={documentColor}
				fallback={DEFAULT_DOCUMENT_ACCENT}
				disabled={!canEdit || saving}
				onChange={setDocumentColor}
			/>

			{message && (
				<div
					role="status"
					className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
						message.kind === 'ok'
							? 'bg-emerald-50 border-emerald-200 text-emerald-800'
							: 'bg-rose-50 border-rose-200 text-rose-800'
					}`}
				>
					{message.kind === 'ok' ? (
						<CheckCircle2 className="w-4 h-4 shrink-0" />
					) : (
						<AlertCircle className="w-4 h-4 shrink-0" />
					)}
					<span>{message.text}</span>
				</div>
			)}

			{canEdit ? (
				<div className="flex items-center justify-end gap-2 mt-4">
					<button
						type="button"
						onClick={handleDiscard}
						disabled={!dirty || saving}
						className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
					>
						Discard
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={!dirty || saving || anyInvalid}
						className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
					>
						{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
						Save colours
					</button>
				</div>
			) : (
				<p className="text-[11px] text-slate-400 mt-4">Only an owner or administrator can change the company colours.</p>
			)}
		</div>
		{below}
		</div>

		<div className="xl:sticky xl:top-2 max-w-xl bg-slate-50/70 rounded-2xl border border-slate-200 p-5">
			<ColourPreview
				appColor={appColor}
				sidebarColor={sidebarColor}
				documentColor={documentColor}
				businessName={profile?.businessName}
				loginImageUrl={profile?.loginImagePath ? resolveLogoUrl(profile.loginImagePath, profile.updatedAt) : null}
			/>
		</div>
		</div>
	);
}
