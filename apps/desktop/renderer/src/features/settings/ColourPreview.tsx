import { buildScale, DEFAULT_APP_COLOR, DEFAULT_SIDEBAR_COLOR, isValidColor } from '../../lib/theme';
import { DEFAULT_DOCUMENT_ACCENT } from '../../lib/documentBranding';

interface ColourPreviewProps {
	appColor: string;
	sidebarColor: string;
	documentColor: string;
	businessName?: string | null;
	/** The company's login picture, when it has one. */
	loginImageUrl?: string | null;
}

const pick = (value: string, fallback: string) => (isValidColor(value) ? value.trim() : fallback);

/** The sidebar / login background, built the same way as the real screens (colour, through black, to its darkest shade). */
function darkGradient(side: ReturnType<typeof buildScale>, reverse = false) {
	return reverse
		? `linear-gradient(135deg, ${side[950]}, #000000, ${side[950]})`
		: `linear-gradient(135deg, ${side[900]}, #000000, ${side[950]})`;
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div>
			<p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{title}</p>
			<div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden aspect-[16/9] w-full">{children}</div>
		</div>
	);
}

/**
 * Small mock-ups of the main app, the login page and an invoice that repaint as colours are chosen, so a company
 * can see the result before saving. They are drawings, not the real screens.
 */
export function ColourPreview({ appColor, sidebarColor, documentColor, businessName, loginImageUrl }: ColourPreviewProps) {
	const app = buildScale(pick(appColor, DEFAULT_APP_COLOR));
	const side = buildScale(pick(sidebarColor, DEFAULT_SIDEBAR_COLOR));
	const docColor = pick(documentColor, DEFAULT_DOCUMENT_ACCENT);
	const doc = buildScale(docColor);
	const name = businessName?.trim() || 'Your Company';

	return (
		<div className="space-y-4" aria-label="Live colour preview">
			<div>
				<h3 className="text-sm font-bold text-slate-800">Live preview</h3>
				<p className="text-[11px] text-slate-500">Updates as you choose. Save colours to keep them.</p>
			</div>

			{/* ── Main app ───────────────────────────────────────────── */}
			<Frame title="The app">
				<div className="flex h-full" data-testid="preview-app">
					<div className="w-[27%] p-2 flex flex-col gap-1.5" style={{ backgroundImage: darkGradient(side) }} data-testid="preview-sidebar">
						<div className="flex items-center gap-1.5 mb-1">
							<span className="h-3.5 w-3.5 rounded" style={{ backgroundColor: side[600] }} />
							<span className="h-1.5 w-10 rounded bg-white/80" />
						</div>
						<span className="h-3.5 rounded flex items-center px-1.5" style={{ backgroundColor: side[800] }}>
							<span className="h-1 w-8 rounded bg-white/90" />
						</span>
						<span className="h-3.5 rounded flex items-center px-1.5"><span className="h-1 w-7 rounded bg-white/40" /></span>
						<span className="h-3.5 rounded flex items-center px-1.5"><span className="h-1 w-9 rounded bg-white/40" /></span>
						<span className="h-3.5 rounded flex items-center px-1.5"><span className="h-1 w-6 rounded bg-white/40" /></span>
					</div>
					<div className="flex-1 bg-slate-50 p-2.5 flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<span className="h-2 w-16 rounded bg-slate-700" />
							<span
								className="h-4 px-2 rounded text-[7px] font-bold text-white flex items-center"
								style={{ backgroundColor: app[600] }}
								data-testid="preview-button"
							>
								+ New Job Card
							</span>
						</div>
						<div className="grid grid-cols-3 gap-1.5">
							{[0, 1, 2].map((i) => (
								<div key={i} className="rounded bg-white border border-slate-200 p-1.5">
									<span className="block h-1 w-6 rounded bg-slate-300 mb-1" />
									<span className="block h-2 w-8 rounded" style={{ backgroundColor: i === 0 ? app[600] : app[200] }} />
								</div>
							))}
						</div>
						<div className="flex-1 rounded bg-white border border-slate-200 p-1.5 flex flex-col gap-1">
							<div className="flex gap-1">
								<span className="h-1.5 w-8 rounded" style={{ backgroundColor: app[100] }} />
								<span className="h-1.5 w-5 rounded" style={{ backgroundColor: app[700] }} />
							</div>
							<span className="h-1 w-full rounded bg-slate-100" />
							<span className="h-1 w-5/6 rounded bg-slate-100" />
							<span className="h-1 w-2/3 rounded bg-slate-100" />
						</div>
					</div>
				</div>
			</Frame>

			{/* ── Login page ─────────────────────────────────────────── */}
			<Frame title="Login page">
				<div className="flex h-full" data-testid="preview-login">
					<div className="relative w-1/2 p-3 flex flex-col justify-center gap-1.5 overflow-hidden" style={{ backgroundImage: darkGradient(side, true) }}>
						{loginImageUrl && (
							<>
								<img src={loginImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" data-testid="preview-login-image" />
								<span className="absolute inset-0 bg-black/45" />
							</>
						)}
						<span className="relative h-2 w-16 rounded bg-white/90" />
						<span className="relative h-2 w-20 rounded" style={{ backgroundColor: side[300] }} />
						<span className="relative h-1 w-24 rounded bg-white/30" />
						<span className="relative h-1 w-20 rounded bg-white/30" />
					</div>
					<div className="w-1/2 p-3 flex items-center justify-center" style={{ backgroundImage: darkGradient(side) }}>
						<div className="w-full rounded-lg bg-white p-2 flex flex-col gap-1.5">
							<span className="h-1.5 w-12 rounded bg-slate-400" />
							<span className="h-2.5 rounded border border-slate-200 bg-slate-50" />
							<span className="h-2.5 rounded border border-slate-200 bg-slate-50" />
							<span className="h-3.5 rounded flex items-center justify-center text-[7px] font-bold text-white" style={{ backgroundColor: side[600] }} data-testid="preview-signin">
								Sign In
							</span>
						</div>
					</div>
				</div>
			</Frame>

			{/* ── Invoice ────────────────────────────────────────────── */}
			<Frame title="Invoice and job card">
				<div className="h-full bg-white p-3 flex flex-col gap-1.5" data-testid="preview-invoice">
					<div className="flex items-start justify-between">
						<span className="text-[9px] font-extrabold uppercase tracking-tight" style={{ color: docColor }} data-testid="preview-invoice-title">
							{name}
						</span>
						<span className="text-[9px] font-extrabold uppercase" style={{ color: docColor }}>
							Tax Invoice
						</span>
					</div>
					<span className="h-[2px] w-full rounded" style={{ backgroundColor: docColor }} data-testid="preview-invoice-rule" />
					<div className="flex gap-1">
						<span className="h-3 flex-1 rounded-sm" style={{ backgroundColor: doc[50] }} />
						<span className="h-3 flex-1 rounded-sm" style={{ backgroundColor: doc[50] }} />
					</div>
					<div className="flex flex-col gap-1">
						<span className="h-2 rounded-sm bg-slate-100" />
						<span className="h-1.5 rounded-sm bg-slate-100" />
					</div>
					<div className="mt-auto flex justify-end">
						<span className="text-[9px] font-extrabold font-mono" style={{ color: docColor }}>
							Grand Total  ₹14,160.00
						</span>
					</div>
				</div>
			</Frame>
		</div>
	);
}
