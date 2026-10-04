import { useEffect, useState } from 'react';
import { FileText, Loader2, Save, Info } from 'lucide-react';
import { getInvoiceSeries, updateInvoiceSeries, type InvoiceSeriesDto, type InvoiceSeriesSettingsDto } from '../../lib/api';

// Mirrors backend InvoiceNumberRules.NormalizePrefix (provisional; the API enforces it).
const PREFIX_PATTERN = /^[A-Za-z0-9/-]{1,10}$/;

function previewNumber(prefix: string, series: InvoiceSeriesDto): string {
	return `${prefix}${series.nextNumberDisplay}`;
}

interface SeriesCardProps {
	title: string;
	series: InvoiceSeriesDto;
	prefix: string;
	canEdit: boolean;
	error?: string;
	onPrefixChange: (value: string) => void;
	testId: string;
}

function SeriesCard({ title, series, prefix, canEdit, error, onPrefixChange, testId }: SeriesCardProps) {
	const example = PREFIX_PATTERN.test(prefix.trim()) ? previewNumber(prefix.trim().toUpperCase(), series) : '—';
	return (
		<div className="bg-slate-50 rounded-xl p-4 border border-slate-200" data-testid={testId}>
			<p className="text-sm font-bold text-slate-800 mb-3">{title}</p>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<div>
					<label htmlFor={`${testId}-prefix`} className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
						Prefix
					</label>
					<input
						id={`${testId}-prefix`}
						type="text"
						value={prefix}
						disabled={!canEdit}
						maxLength={10}
						onChange={(e) => onPrefixChange(e.target.value.toUpperCase())}
						className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono uppercase disabled:bg-slate-100 disabled:text-slate-500"
					/>
					{error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
				</div>
				<div>
					<span className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Next Number</span>
					<div
						className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-700"
						aria-label={`${title} next number`}
					>
						{series.nextNumberDisplay}
					</div>
					<p className="text-[11px] text-slate-400 mt-1">Read-only — assigned by the system</p>
				</div>
			</div>
			<p className="text-[11px] text-slate-500 mt-3">
				Example: <span className="font-mono font-semibold text-slate-700" data-testid={`${testId}-example`}>{example}</span>
			</p>
		</div>
	);
}

/** Invoice Configuration: separate GST and non-GST numbering series. Prefixes are editable by the Owner only. */
export function InvoiceSeriesSection({ isOwner }: { isOwner: boolean }) {
	const [data, setData] = useState<InvoiceSeriesSettingsDto | null>(null);
	const [gstPrefix, setGstPrefix] = useState('');
	const [nonGstPrefix, setNonGstPrefix] = useState('');
	const [loadError, setLoadError] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [saving, setSaving] = useState(false);

	const apply = (result: InvoiceSeriesSettingsDto) => {
		setData(result);
		setGstPrefix(result.gst.prefix);
		setNonGstPrefix(result.nonGst.prefix);
	};

	useEffect(() => {
		let cancelled = false;
		getInvoiceSeries()
			.then((result) => { if (!cancelled) apply(result); })
			.catch((err: unknown) => {
				if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load invoice numbering.');
			});
		return () => { cancelled = true; };
	}, []);

	const gstError = gstPrefix.trim() && !PREFIX_PATTERN.test(gstPrefix.trim()) ? "1–10 characters: letters, digits, '-' and '/'" : undefined;
	const nonGstError = nonGstPrefix.trim() && !PREFIX_PATTERN.test(nonGstPrefix.trim()) ? "1–10 characters: letters, digits, '-' and '/'" : undefined;
	const sameError = gstPrefix.trim() && gstPrefix.trim().toUpperCase() === nonGstPrefix.trim().toUpperCase()
		? 'GST and non-GST prefixes must be different.'
		: undefined;
	const isChanged = Boolean(data) && (gstPrefix.trim() !== data!.gst.prefix || nonGstPrefix.trim() !== data!.nonGst.prefix);
	const canSave = isOwner && isChanged && !gstError && !nonGstError && !sameError
		&& gstPrefix.trim().length > 0 && nonGstPrefix.trim().length > 0 && !saving;

	const handleSave = async () => {
		if (!canSave) return;
		setSaving(true);
		setSaveError(null);
		setSaved(false);
		try {
			apply(await updateInvoiceSeries({ gstPrefix: gstPrefix.trim(), nonGstPrefix: nonGstPrefix.trim() }));
			setSaved(true);
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : 'Failed to save invoice number prefixes.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
			<div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
				<FileText className="w-5 h-5 text-blue-600" />
				<h2 className="text-base font-bold text-slate-800">Invoice Configuration</h2>
			</div>

			{loadError && <p role="alert" className="text-xs text-red-600 mb-3">{loadError}</p>}

			{!data && !loadError && (
				<div className="flex items-center gap-2 text-xs text-slate-500">
					<Loader2 className="w-4 h-4 animate-spin" /> Loading invoice numbering…
				</div>
			)}

			{data && (
				<>
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<SeriesCard
							title="GST Invoice Series"
							series={data.gst}
							prefix={gstPrefix}
							canEdit={isOwner}
							error={gstError ?? sameError}
							onPrefixChange={setGstPrefix}
							testId="gst-series"
						/>
						<SeriesCard
							title="Non-GST Invoice Series"
							series={data.nonGst}
							prefix={nonGstPrefix}
							canEdit={isOwner}
							error={nonGstError}
							onPrefixChange={setNonGstPrefix}
							testId="non-gst-series"
						/>
					</div>

					<div className="mt-4 bg-blue-50/60 rounded-xl p-3.5 border border-blue-100 text-[11px] text-slate-600 space-y-1">
						<p className="flex items-start gap-1.5"><Info className="w-3.5 h-3.5 text-blue-600 mt-px shrink-0" />GST and non-GST documents use separate numbering sequences.</p>
						<p className="pl-5">Invoice numbers are automatically assigned when an invoice is finalized.</p>
						<p className="pl-5">GST invoice numbers can be changed by the Owner after the invoice is fully paid.</p>
						{!isOwner && <p className="pl-5 font-medium text-slate-700">Only the Owner can change prefixes.</p>}
					</div>

					{saveError && <p role="alert" className="text-xs text-red-600 mt-3">{saveError}</p>}
					{saved && <p className="text-xs text-green-700 mt-3">Invoice number prefixes saved.</p>}

					{isOwner && (
						<div className="flex justify-end mt-4">
							<button
								type="button"
								onClick={handleSave}
								disabled={!canSave}
								className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
							>
								{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
								{saving ? 'Saving...' : 'Save Invoice Series'}
							</button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
