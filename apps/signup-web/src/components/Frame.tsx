import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Download, Lock, Phone } from 'lucide-react';
import { links } from '@/lib/config';

const PHONE = '+91 90426 72148';

export function Header() {
	return (
		<header className="no-print border-b border-border-hairline">
			<div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
				<Link to="/" className="flex shrink-0 items-center" aria-label="Baylior home">
					<img src="/brand/baylior-lockup-on-dark.svg" alt="Baylior Business Suite" className="h-8 w-auto sm:h-10" />
				</Link>
				<nav aria-label="Help" className="flex items-center gap-2 text-label sm:gap-4">
					<a href={links.product} aria-label="About Baylior" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap text-text-secondary hover:text-text-heading">
						<ArrowLeft className="size-3.5" aria-hidden /> <span><span className="hidden sm:inline">About </span>Baylior</span>
					</a>
					{(links.windowsDownload || links.androidDownload) && (
						<a href="#apps" className="hidden items-center gap-1.5 text-text-secondary hover:text-text-heading lg:inline-flex">
							<Download className="size-3.5" aria-hidden /> Already registered? Download the app
						</a>
					)}
					<a href={`tel:${PHONE.replace(/\s/g, '')}`} aria-label={`Call Trovo on ${PHONE}`} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 text-text-secondary hover:text-text-heading">
						<Phone className="size-3.5 text-action" aria-hidden />
						<span className="hidden lg:inline">Contact: {PHONE}</span>
					</a>
				</nav>
			</div>
		</header>
	);
}

export function Footer() {
	return (
		<footer className="no-print mt-16 border-t border-border-hairline">
			<div className="mx-auto flex max-w-[1120px] flex-col gap-3 px-4 py-6 text-label text-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
				<span>© {new Date().getFullYear()} Baylior · by Trovo Tech Solutions, Erode, Tamil Nadu</span>
				<nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
					<a href={links.product} className="hover:text-text-heading">About Baylior</a>
					<a href={links.terms} className="hover:text-text-heading">Terms</a>
					<a href={links.privacy} className="hover:text-text-heading">Privacy policy</a>
					<a href={links.refund} className="hover:text-text-heading">Refund policy</a>
					<a href={links.contact} className="hover:text-text-heading">Contact</a>
					<a href="mailto:info@trovotechsolutions.in" className="text-text-secondary hover:text-text-heading">info@trovotechsolutions.in</a>
				</nav>
			</div>
		</footer>
	);
}

export function Page({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
	return (
		<div className="flex min-h-full flex-col">
			<Header />
			<main className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10 ${narrow ? 'max-w-[720px]' : 'max-w-[1120px]'}`}>{children}</main>
			<Footer />
		</div>
	);
}

const STEPS = ['Your business', 'Plan & users', 'Review & pay'];

/** The 3-step indicator on the sign-up screens. */
export function Steps({ current }: { current: 1 | 2 | 3 }) {
	return (
		<ol aria-label="Sign-up steps" className="mx-auto mb-8 flex max-w-[720px] items-center justify-between gap-2">
			{STEPS.map((label, index) => {
				const step = index + 1;
				const done = step < current;
				const active = step === current;
				return (
					<li key={label} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={active ? 'step' : undefined}>
						<span
							className={`flex size-9 shrink-0 items-center justify-center rounded-full text-label font-semibold ${
								active ? 'bg-brand text-white' : done ? 'bg-active-bg text-active' : 'border border-border-subtle text-text-muted'
							}`}
						>
							{done ? <Check className="size-4" aria-hidden /> : step}
						</span>
						<span className="hidden leading-tight sm:block">
							<span className={`block text-micro font-semibold tracking-wider uppercase ${active ? 'text-action' : 'text-text-muted'}`}>Step {step}</span>
							<span className={`block text-body ${active || done ? 'text-text-heading' : 'text-text-muted'}`}>{label}</span>
						</span>
						{step < STEPS.length && <span className="mx-1 h-px flex-1 bg-border-subtle" aria-hidden />}
					</li>
				);
			})}
		</ol>
	);
}

export function PrivacyNote() {
	return (
		<p className="mt-4 flex items-center justify-center gap-2 text-label text-text-muted">
			<Lock className="size-3.5 text-active" aria-hidden /> Your details are used only for your Baylior account and invoices.
		</p>
	);
}
