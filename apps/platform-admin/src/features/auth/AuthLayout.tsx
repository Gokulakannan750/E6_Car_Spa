import type { ReactNode } from 'react';

/** The centred card used by every sign-in step, on the dark canvas with the soft brand glow. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
	return (
		<div className="relative flex min-h-full flex-col bg-canvas">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(37,99,235,0.14),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(239,68,68,0.10),transparent_45%)]"
			/>
			<header className="relative flex h-16 items-center gap-3 border-b border-border-hairline px-6">
				<img src="/trovo-logo.webp" alt="" className="size-8 rounded-md" />
				<span className="text-title font-semibold text-text-heading">Trovo Platform</span>
			</header>
			<main className="relative flex flex-1 items-center justify-center px-4 py-10">
				<div className="w-full max-w-[420px] rounded-lg border border-border-subtle bg-surface-card p-8 shadow-2xl shadow-black/50">
					<div className="mb-6 flex flex-col items-center text-center">
						<img src="/trovo-logo.webp" alt="Trovo" className="mb-4 size-14 rounded-lg shadow-[0_0_24px_rgba(59,130,246,0.25)]" />
						<h1 className="text-headline font-semibold text-text-heading">{title}</h1>
						<p className="mt-1 text-body text-text-secondary">{subtitle}</p>
					</div>
					{children}
					<p className="mt-6 text-center text-label text-text-muted">Only for Trovo staff. Every action is recorded.</p>
				</div>
			</main>
			<footer className="relative flex h-12 items-center border-t border-border-hairline px-6 text-label text-text-muted">
				© {new Date().getFullYear()} Trovo Tech Solutions
			</footer>
		</div>
	);
}
