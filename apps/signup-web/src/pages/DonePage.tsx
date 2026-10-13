import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download, Info, KeyRound, Lock, Network, Printer, Smartphone } from 'lucide-react';
import { Page } from '@/components/Frame';
import { Button, Card, CodeBox } from '@/components/ui';
import { links } from '@/lib/config';
import { date, money } from '@/lib/format';
import { useSignup } from '@/state/signup';

/** After the trial starts or the payment is confirmed: the two codes and what to do next. */
export function DonePage() {
	const { result, business, choice } = useSignup();

	useEffect(() => {
		document.title = 'Your company is ready · Trovo';
	}, []);

	if (!result?.companyCode) return <Navigate to="/" replace />;
	const trial = result.start === 'Trial';

	return (
		<Page narrow>
			<div className="text-center">
				<CheckCircle2 className="mx-auto size-16 text-active" aria-hidden />
				<h1 className="mt-5 text-headline font-bold text-text-heading sm:text-display">
					{trial ? 'Your free trial has started' : `${business.name} is ready`}
				</h1>
				<p className="mt-2 text-body text-text-secondary">
					{trial ? (
						<>
							Full Professional until <strong className="text-text-heading">{date(result.trialEndsAt)}</strong>. <span className="text-active">No payment taken.</span>
						</>
					) : (
						<>
							<span className="text-active">Paid {money(result.amountMinor, result.currency)}</span> · valid until{' '}
							<strong className="text-text-heading">{date(result.paidUntil)}</strong>
							{result.invoiceNumber && <> · invoice {result.invoiceNumber}</>}
						</>
					)}
				</p>
			</div>

			{trial && (
				<div className="mt-8 flex items-start gap-3 rounded-lg border border-action/40 bg-action/10 p-4 text-body text-text-primary">
					<Info className="mt-0.5 size-5 shrink-0 text-action" aria-hidden />
					<span>Before the trial ends, choose a plan and pay. If you don't, you get a few more days to pay, then the software becomes read-only. Your data is never deleted.</span>
				</div>
			)}

			{result.franchisorName && result.franchiseLinked && (
				<div className="mt-6 flex items-start gap-3 rounded-lg border border-active/30 bg-active-bg p-4 text-body text-text-primary">
					<Network className="mt-0.5 size-5 shrink-0 text-active" aria-hidden />
					<span>
						Linked to the franchise network of <strong className="text-text-heading">{result.franchisorName}</strong>. You can see and change what they
						see in the app, under Franchise.
					</span>
				</div>
			)}
			{result.franchisorName && !result.franchiseLinked && (
				<div role="status" className="mt-6 flex items-start gap-3 rounded-lg border border-pastdue/40 bg-pastdue-bg p-4 text-body text-text-primary">
					<AlertTriangle className="mt-0.5 size-5 shrink-0 text-pastdue" aria-hidden />
					<span>
						Your company is ready, but it could not be linked to {result.franchisorName}
						{result.franchiseProblem ? `: ${result.franchiseProblem}` : '.'} Ask your franchisor to send you an invitation from the app.
					</span>
				</div>
			)}

			<Card className="mt-8 border-action/40 p-6">
				<div className="flex items-start gap-3">
					<KeyRound className="mt-0.5 size-5 shrink-0 text-action" aria-hidden />
					<div>
						<h2 className="text-title font-semibold text-text-heading">Your codes — save them now</h2>
						<p className="text-label text-text-secondary">You need both when you open the Trovo app for the first time. They are not shown again.</p>
					</div>
				</div>
				<div className="mt-5 grid gap-4 sm:grid-cols-2">
					<CodeBox label="Company code" value={result.companyCode} />
					<CodeBox label="One-time registration code" value={result.registrationCode ?? '—'} note="Single use" />
				</div>
				{result.registrationCodeExpiresAt && (
					<p className="mt-4 flex items-center gap-2 rounded-md border border-pastdue/40 bg-pastdue-bg px-4 py-2.5 text-label text-text-primary">
						<Lock className="size-3.5 shrink-0 text-pastdue" aria-hidden />
						The registration code works once and expires on <strong>{date(result.registrationCodeExpiresAt)}</strong>. Keep it private.
					</p>
				)}
			</Card>

			<Card className="mt-6 p-6">
				<h2 className="text-title font-semibold text-text-heading">What to do next</h2>
				<ol className="mt-5 flex flex-col gap-6">
					<li id="apps" className="flex gap-4">
						<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-action/15 text-label font-semibold text-action">1</span>
						<div>
							<div className="text-body font-semibold text-text-heading">Install the app</div>
							<p className="mt-1 text-label text-text-secondary">On your counter PC (Windows) and your phones (Android).</p>
							<div className="mt-3 flex flex-wrap gap-3">
								{links.windowsDownload ? (
									<a href={links.windowsDownload} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-action px-4 text-body font-semibold text-white hover:bg-action-hover">
										<Download className="size-4" aria-hidden /> Download for Windows
									</a>
								) : null}
								{links.androidDownload ? (
									<a href={links.androidDownload} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border-subtle bg-surface-card px-4 text-body font-semibold text-text-heading hover:bg-surface-raised">
										<Smartphone className="size-4" aria-hidden /> Get it on Android
									</a>
								) : null}
								{!links.windowsDownload && !links.androidDownload && (
									<p className="text-label text-text-secondary">Call +91 90426 72148 and Trovo sends you the installers.</p>
								)}
							</div>
						</div>
					</li>
					<li className="flex gap-4">
						<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-action/15 text-label font-semibold text-action">2</span>
						<div>
							<div className="text-body font-semibold text-text-heading">Open the app and choose "Register your company"</div>
							<p className="mt-1 text-label text-text-secondary">
								Enter the company code <code className="font-mono text-text-heading">{result.companyCode}</code> and the registration code.
							</p>
						</div>
					</li>
					<li className="flex gap-4">
						<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-action/15 text-label font-semibold text-action">3</span>
						<div>
							<div className="text-body font-semibold text-text-heading">Create your owner username and password</div>
							<p className="mt-1 text-label text-text-secondary">
								Then add your staff on the Users screen and give each one a licence (Windows + Android, Windows or Android).
								{!trial && ` You have ${choice.licences.android + choice.licences.windows + choice.licences.both} licences.`}
							</p>
						</div>
					</li>
				</ol>
			</Card>

			<div className="no-print mt-6 flex flex-col justify-center gap-3 sm:flex-row">
				<Button onClick={() => window.print()} icon={<Printer className="size-4" />}>
					Print this page
				</Button>
				{trial && (
					<Link to="/" className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-subtle px-5 text-body font-semibold text-text-heading hover:bg-surface-raised">
						See plans and prices
					</Link>
				)}
			</div>
			<p className="mt-8 text-center text-label text-text-muted">
				Need help? Call <a href="tel:+919042672148" className="text-action">+91 90426 72148</a> or email{' '}
				<a href="mailto:info@trovotechsolutions.in" className="text-action">
					info@trovotechsolutions.in
				</a>
				.
			</p>
		</Page>
	);
}
