import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Sparkles, Check } from 'lucide-react';
import {
	getManagedWhatsAppTemplates,
	provisionManagedWhatsAppTemplates,
	activateManagedWhatsAppTemplates,
	type ManagedWhatsAppTemplatesResponse,
	type ManagedTemplateProvisionResultDto,
} from '../../lib/api';

interface Props {
	canManage: boolean;
	/** Called after the app switched to the standard templates, so the parent can reload its settings. */
	onActivated?: () => void;
}

const STATUS_STYLES: Record<string, string> = {
	APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
	PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
	IN_APPEAL: 'bg-amber-50 text-amber-700 border-amber-200',
	REJECTED: 'bg-red-50 text-red-700 border-red-200',
	PAUSED: 'bg-red-50 text-red-700 border-red-200',
	DISABLED: 'bg-red-50 text-red-700 border-red-200',
	NOT_CREATED: 'bg-slate-50 text-slate-600 border-slate-200',
};

function statusLabel(status: string) {
	return status === 'NOT_CREATED' ? 'Not created' : status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ');
}

/** Standard (managed) WhatsApp templates: create them on the business's WhatsApp account, track approval, switch to them. */
export function ManagedTemplatesPanel({ canManage, onActivated }: Props) {
	const [data, setData] = useState<ManagedWhatsAppTemplatesResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<'provision' | 'activate' | null>(null);
	const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
	const [results, setResults] = useState<ManagedTemplateProvisionResultDto[]>([]);

	async function refresh() {
		try {
			setLoading(true);
			setData(await getManagedWhatsAppTemplates());
		} catch (err: unknown) {
			setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed to load template status.' });
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		refresh();
	}, []);

	async function handleProvision() {
		try {
			setBusy('provision');
			setMessage(null);
			const res = await provisionManagedWhatsAppTemplates();
			setResults(res.results);
			setMessage({ ok: res.isSuccess, text: res.message });
			await refresh();
		} catch (err: unknown) {
			setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed to create templates.' });
		} finally {
			setBusy(null);
		}
	}

	async function handleActivate() {
		try {
			setBusy('activate');
			setMessage(null);
			setResults([]);
			const res = await activateManagedWhatsAppTemplates();
			setMessage({ ok: res.isSuccess, text: res.message });
			await refresh();
			if (res.isSuccess) onActivated?.();
		} catch (err: unknown) {
			setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed to switch templates.' });
		} finally {
			setBusy(null);
		}
	}

	const templates = data?.templates ?? [];
	const allCreated = templates.length > 0 && templates.every((t) => t.status !== 'NOT_CREATED');
	const allActive = templates.length > 0 && templates.every((t) => t.isActive);

	return (
		<div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs" data-testid="managed-templates-panel">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
				<div>
					<h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
						<Sparkles className="w-4 h-4 text-emerald-600" />
						<span>Standard Message Templates</span>
					</h4>
					<p className="text-[11px] text-slate-500">
						Ready-made invoice and payment templates. Create them once on your WhatsApp account; Meta reviews them, usually within minutes (at most a day).
					</p>
				</div>
				<button
					type="button"
					onClick={refresh}
					disabled={loading || busy !== null}
					className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
				>
					<RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
					Refresh status
				</button>
			</div>

			{data && !data.isSuccess && (
				<p className="text-[11px] text-amber-700 flex items-start gap-1.5">
					<AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />
					{data.message}
				</p>
			)}

			<table className="w-full text-xs">
				<thead>
					<tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
						<th className="py-2 font-semibold">Purpose</th>
						<th className="py-2 font-semibold">Template</th>
						<th className="py-2 font-semibold">Status</th>
						<th className="py-2 font-semibold">In use</th>
					</tr>
				</thead>
				<tbody>
					{templates.map((t) => (
						<tr key={t.name} className="border-b border-slate-50 align-top" data-testid={`managed-template-${t.name}`}>
							<td className="py-2 text-slate-800 font-medium">{t.purpose}</td>
							<td className="py-2 font-mono text-[11px] text-slate-600">{t.name}</td>
							<td className="py-2">
								<span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold ${STATUS_STYLES[t.status] ?? STATUS_STYLES.NOT_CREATED}`}>
									{statusLabel(t.status)}
								</span>
								{t.rejectedReason && <p className="text-[10px] text-red-600 mt-1">Reason: {t.rejectedReason}</p>}
							</td>
							<td className="py-2">
								{t.isActive ? (
									<span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-semibold">
										<Check className="w-3.5 h-3.5" /> In use
									</span>
								) : (
									<span className="text-slate-400 text-[11px]">—</span>
								)}
							</td>
						</tr>
					))}
					{loading && templates.length === 0 && (
						<tr>
							<td colSpan={4} className="py-3 text-slate-500">
								<Loader2 className="w-3.5 h-3.5 inline animate-spin mr-1" /> Loading template status…
							</td>
						</tr>
					)}
				</tbody>
			</table>

			{message && (
				<div
					role="status"
					className={`p-3 rounded-xl text-[11px] flex items-start gap-1.5 border ${message.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}
				>
					{message.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />}
					<div className="space-y-1">
						<p>{message.text}</p>
						{results
							.filter((r) => r.outcome === 'Failed')
							.map((r) => (
								<p key={r.name}>
									<span className="font-mono">{r.name}</span>: {r.error}
								</p>
							))}
					</div>
				</div>
			)}

			{canManage ? (
				<div className="flex flex-wrap justify-end gap-2">
					<button
						type="button"
						onClick={handleProvision}
						disabled={busy !== null || loading || allCreated}
						className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
					>
						{busy === 'provision' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
						Create standard templates
					</button>
					<button
						type="button"
						onClick={handleActivate}
						disabled={busy !== null || loading || !data?.canActivate || allActive}
						className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
					>
						{busy === 'activate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
						Use approved templates
					</button>
				</div>
			) : (
				<p className="text-[11px] text-slate-500">Only users who can manage business settings can create or switch templates.</p>
			)}
		</div>
	);
}
