import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Loader2, Pencil, XCircle, Zap } from 'lucide-react';
import { Page, Steps } from '@/components/Frame';
import { Alert, Button, Card } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { links } from '@/lib/config';
import { date, money, moneyShort } from '@/lib/format';
import { LICENCE_TYPES, isBusinessComplete } from '@/lib/rules';
import { useSignup } from '@/state/signup';

type Phase = 'review' | 'processing' | 'failed';

export function ReviewStep() {
	const navigate = useNavigate();
	const { business, choice, order, setOrder, setResult } = useSignup();
	const catalog = useQuery({ queryKey: ['catalog'], queryFn: api.catalog });
	const quote = useQuery({ queryKey: ['quote', choice], queryFn: () => api.quote(choice), retry: false });
	const [accepted, setAccepted] = useState(false);
	const [phase, setPhase] = useState<Phase>('review');
	const [failure, setFailure] = useState<string | null>(null);

	useEffect(() => {
		document.title = 'Review and pay · Trovo sign-up';
	}, []);

	const pay = useMutation({
		mutationFn: async () => {
			// Place the order once (its price is fixed then), then pay it. A retry pays the same order.
			const placed = order?.orderToken ? order : await api.placeOrder(business, choice, accepted);
			if (!order?.orderToken) setOrder(placed);
			setPhase('processing');
			return api.payTest(placed.orderId, placed.orderToken!);
		},
		onSuccess: (result) => {
			setResult(result);
			navigate('/signup/done');
		},
		onError: (error) => {
			const message = error instanceof Error ? error.message : 'The payment did not go through.';
			// An expired or already-used order cannot be paid again: start a new one on the next try.
			if (error instanceof ApiError && (error.status === 409 || error.status === 404)) setOrder(null);
			if (phase === 'processing' || order?.orderToken) {
				setFailure(message);
				setPhase('failed');
			} else {
				setFailure(message);
			}
		},
	});

	if (!isBusinessComplete(business)) return <Navigate to="/signup" replace />;

	const testPayments = catalog.data?.testPayments ?? false;
	const plan = catalog.data?.plans.find((p) => p.code === choice.planCode);
	const total = quote.data?.totalMinor ?? 0;
	const start = new Date();
	const end = new Date(start);
	if (choice.interval === 'Year') end.setFullYear(end.getFullYear() + 1);
	else end.setMonth(end.getMonth() + 1);
	end.setDate(end.getDate() - 1);

	if (phase === 'processing') {
		return (
			<Page narrow>
				<Card className="mx-auto mt-10 p-10 text-center">
					<Loader2 className="mx-auto size-10 animate-spin text-action" aria-hidden />
					<h1 className="mt-5 text-headline font-semibold text-text-heading">Confirming your payment…</h1>
					<p className="mt-2 text-body text-text-secondary">Please don't close this page. This usually takes a few seconds.</p>
				</Card>
			</Page>
		);
	}

	if (phase === 'failed') {
		return (
			<Page narrow>
				<Card className="mx-auto mt-10 p-10 text-center">
					<XCircle className="mx-auto size-12 text-danger" aria-hidden />
					<h1 className="mt-5 text-headline font-semibold text-text-heading">Payment didn't go through</h1>
					<p className="mt-2 text-body text-text-secondary">{failure}</p>
					<div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
						<Button
							variant="primary"
							onClick={() => {
								setPhase('review');
								setFailure(null);
								pay.reset();
							}}
						>
							Try again
						</Button>
						<Button onClick={() => navigate('/signup/plan')}>Change plan</Button>
					</div>
					<p className="mt-6 text-label text-text-muted">
						Money taken but this page failed? Call +91 90426 72148 with your mobile number — we'll sort it out.
					</p>
				</Card>
			</Page>
		);
	}

	return (
		<Page>
			<Steps current={3} />
			{testPayments && (
				<div role="status" className="mb-6 flex items-start gap-3 rounded-lg border border-pastdue/40 bg-pastdue-bg px-5 py-4">
					<AlertTriangle className="mt-0.5 size-5 shrink-0 text-pastdue" aria-hidden />
					<div>
						<div className="text-body font-semibold text-text-heading">Test mode — no real money is taken</div>
						<div className="text-label text-text-secondary">Payment is simulated on this test server.</div>
					</div>
				</div>
			)}
			<div className="grid gap-8 lg:grid-cols-[1fr_380px]">
				<div className="flex flex-col gap-6">
					<Card className="p-6">
						<div className="flex items-center justify-between">
							<h2 className="text-title font-semibold text-text-heading">Your business</h2>
							<Link to="/signup" className="inline-flex items-center gap-1.5 text-label text-action hover:text-action-hover">
								<Pencil className="size-3.5" aria-hidden /> Edit
							</Link>
						</div>
						<dl className="mt-4 grid gap-4 text-body sm:grid-cols-2">
							<div>
								<dt className="text-label text-text-muted">Business</dt>
								<dd className="text-text-heading">{business.name}</dd>
								<dd className="text-label text-text-secondary">
									{business.city}, {business.state}
								</dd>
							</div>
							<div>
								<dt className="text-label text-text-muted">Owner</dt>
								<dd className="text-text-heading">{business.ownerName}</dd>
							</div>
							<div>
								<dt className="text-label text-text-muted">Mobile</dt>
								<dd className="tabular text-text-heading">+91 {business.mobile.replace(/\D/g, '').slice(-10)}</dd>
							</div>
							<div>
								<dt className="text-label text-text-muted">Email</dt>
								<dd className="break-all text-text-heading">{business.email}</dd>
							</div>
							{business.gstin && (
								<div>
									<dt className="text-label text-text-muted">GSTIN</dt>
									<dd className="font-mono text-text-heading">{business.gstin}</dd>
								</div>
							)}
						</dl>
					</Card>

					<Card className="p-6">
						<div className="flex items-center justify-between">
							<h2 className="text-title font-semibold text-text-heading">Your plan</h2>
							<Link to="/signup/plan" className="inline-flex items-center gap-1.5 text-label text-action hover:text-action-hover">
								<Pencil className="size-3.5" aria-hidden /> Edit
							</Link>
						</div>
						<p className="mt-3 text-body text-text-heading">
							{plan?.name ?? choice.planCode} · {choice.interval === 'Year' ? 'Yearly' : 'Monthly'}
						</p>
						<p className="mt-1 text-label text-text-secondary">
							{LICENCE_TYPES.filter((t) => choice.licences[t.key] > 0)
								.map((t) => `${choice.licences[t.key]} ${t.label}`)
								.join(', ')}{' '}
							user licence{choice.licences.android + choice.licences.windows + choice.licences.both === 1 ? '' : 's'}
						</p>
						{Object.keys(choice.addOns).length > 0 && (
							<p className="mt-1 text-label text-text-secondary">
								Add-ons: {Object.keys(choice.addOns).map((code) => catalog.data?.addOns.find((a) => a.code === code)?.name ?? code).join(', ')}
							</p>
						)}
					</Card>

					<label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-subtle bg-surface-card p-5 text-body text-text-primary">
						<input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#3b82f6]" />
						<span>
							I agree to the{' '}
							<a href={links.terms} target="_blank" rel="noopener noreferrer" className="text-action hover:underline">
								Terms
							</a>{' '}
							and the{' '}
							<a href={links.refund} target="_blank" rel="noopener noreferrer" className="text-action hover:underline">
								Refund policy
							</a>
							.
						</span>
					</label>
				</div>

				<aside className="lg:sticky lg:top-6 lg:self-start">
					<Card className="p-6">
						<div className="text-label font-semibold tracking-wider text-text-muted uppercase">Amount to pay</div>
						{quote.isError ? (
							<div className="mt-3">
								<Alert>{quote.error.message}</Alert>
							</div>
						) : (
							<>
								<div className="tabular mt-2 text-display font-bold text-text-heading">{quote.data ? money(total, quote.data.currency) : '…'}</div>
								<div className="mt-1 text-label text-text-secondary">
									for 1 {choice.interval === 'Year' ? 'year' : 'month'} ({date(start.toISOString())} – {date(end.toISOString())})
								</div>
								{quote.data && (
									<ul className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4 text-label">
										{quote.data.lines.map((l) => (
											<li key={l.description} className="flex justify-between gap-3">
												<span className="text-text-secondary">
													{l.description.split(',')[0]?.replace(/ \((monthly|yearly)\)$/, '')}
													{l.quantity > 1 ? ` × ${l.quantity}` : ''}
												</span>
												<span className="tabular text-text-primary">{moneyShort(l.amountMinor)}</span>
											</li>
										))}
										<li className="flex justify-between gap-3 text-active">
											<span>{quote.data.taxMinor > 0 ? 'GST' : 'No GST charged'}</span>
											<span className="tabular">{moneyShort(quote.data.taxMinor)}</span>
										</li>
									</ul>
								)}
								<p className="mt-3 text-label text-text-muted">Billed by Trovo Tech Solutions</p>
							</>
						)}
						{testPayments ? (
							<Button
								variant="primary"
								className="mt-5 w-full text-title"
								disabled={!accepted || !quote.data}
								loading={pay.isPending}
								onClick={() => {
									setFailure(null);
									pay.mutate();
								}}
								icon={<Zap className="size-4" />}
							>
								Pay {quote.data ? moneyShort(total) : ''} (test)
							</Button>
						) : (
							<div className="mt-5">
								<Alert tone="info">Online payment is coming soon. To buy now, call +91 90426 72148 — or start the free trial from the previous step.</Alert>
							</div>
						)}
						{!accepted && quote.data && <p className="mt-2 text-center text-label text-text-muted">Tick the box to agree to the Terms first.</p>}
						{failure && phase === 'review' && (
							<div className="mt-3">
								<Alert>{failure}</Alert>
							</div>
						)}
						<p className="mt-4 text-center text-label text-text-secondary">You'll get your company code and registration code right after payment.</p>
					</Card>
				</aside>
			</div>
			<Button variant="ghost" className="mt-8" onClick={() => navigate('/signup/plan')}>
				<ArrowLeft className="size-4" aria-hidden /> Back to plan and users
			</Button>
		</Page>
	);
}
