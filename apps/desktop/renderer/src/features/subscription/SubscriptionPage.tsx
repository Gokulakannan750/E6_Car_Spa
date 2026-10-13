import { CalendarClock, CheckCircle2, CreditCard, Laptop, MinusCircle, Monitor, Smartphone } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import type { AppAccess } from '../../lib/api';
import { cn } from '../../utils/cn';
import { FEATURES, isFeatureOn } from './subscriptionFeatures';
import { PlanChangeCard } from './PlanChangeCard';
import { OwnerBillingPanel } from './OwnerBillingPanel';

/** The plan modules and add-ons, in the order shown on Trovo's pricing page. */
const MODULES: { key: string; label: string }[] = [
	{ key: FEATURES.outsideJobs, label: 'Outside jobs & vendors' },
	{ key: FEATURES.staffAdvances, label: 'Staff advances & salary' },
	{ key: FEATURES.whatsApp, label: 'WhatsApp automation' },
	{ key: FEATURES.advancedReports, label: 'Advanced reports' },
	{ key: FEATURES.auditTrail, label: 'Audit trail' },
	{ key: FEATURES.showroom, label: 'Showroom / B2B module' },
	{ key: FEATURES.franchiseNetwork, label: 'Franchise network' },
];

const LICENCE_LABEL: Record<AppAccess, { label: string; Icon: typeof Laptop }> = {
	Both: { label: 'Windows + Android', Icon: Laptop },
	Windows: { label: 'Windows only', Icon: Monitor },
	Android: { label: 'Android only', Icon: Smartphone },
};

const STATUS_STYLE: Record<string, string> = {
	Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
	Trialing: 'bg-blue-50 text-blue-700 border-blue-200',
	PastDue: 'bg-amber-50 text-amber-700 border-amber-200',
	ReadOnly: 'bg-orange-50 text-orange-700 border-orange-200',
};

const STATUS_LABEL: Record<string, string> = {
	Active: 'Active',
	Trialing: 'Free trial',
	PastDue: 'Payment overdue',
	ReadOnly: 'Read-only',
	Suspended: 'Suspended',
	Canceled: 'Cancelled',
};

const date = (value?: string | null) =>
	value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** The company's Trovo subscription: plan, status, dates, user licences and modules. Read-only; Trovo makes changes. */
export default function SubscriptionPage() {
	const { subscription, isOwner } = useAuth();

	if (!subscription?.managed) {
		return (
			<div className="space-y-6 w-full">
				<Header />
				<p className="text-sm text-slate-500">This copy of the software is not on a Trovo subscription.</p>
			</div>
		);
	}

	const status = subscription.status ?? '';
	const trial = status === 'Trialing';
	const yearly = subscription.interval === 'Year';

	return (
		<div className="space-y-6 w-full">
			<Header />
			<PlanChangeCard />

			<div className="grid gap-6 lg:grid-cols-3">
				<section aria-label="Plan" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
								<CreditCard className="h-5 w-5" aria-hidden="true" />
							</div>
							<div>
								<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</p>
								<p className="text-lg font-bold text-slate-900">
									{subscription.planName ?? subscription.planCode ?? '—'}
									{!trial && <span className="ml-2 text-sm font-medium text-slate-500">{yearly ? 'Yearly' : 'Monthly'}</span>}
								</p>
							</div>
						</div>
						<span
							className={cn(
								'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
								STATUS_STYLE[status] ?? 'bg-slate-100 text-slate-600 border-slate-200',
							)}
						>
							{STATUS_LABEL[status] ?? status}
						</span>
					</div>

					<dl className="mt-5 grid gap-4 sm:grid-cols-2">
						<div className="flex items-start gap-2.5">
							<CalendarClock className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden="true" />
							<div>
								<dt className="text-xs text-slate-500">{trial ? 'Free trial ends' : 'Paid until'}</dt>
								<dd className="text-sm font-semibold text-slate-900">{date(trial ? subscription.trialEndsAt : subscription.currentPeriodEnd)}</dd>
							</div>
						</div>
						{subscription.graceEndsAt && (
							<div className="flex items-start gap-2.5">
								<CalendarClock className="mt-0.5 h-4 w-4 text-amber-500" aria-hidden="true" />
								<div>
									<dt className="text-xs text-slate-500">Pay before</dt>
									<dd className="text-sm font-semibold text-slate-900">{date(subscription.graceEndsAt)}</dd>
								</div>
							</div>
						)}
					</dl>

					{subscription.banner && <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{subscription.banner.message}</p>}
				</section>

				<section aria-label="User licences" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
					<h2 className="text-sm font-bold text-slate-800">User licences</h2>
					<p className="mt-0.5 text-xs text-slate-500">Each user needs one. Give them out under Users &amp; Access.</p>
					{subscription.licences && subscription.licences.length > 0 ? (
						<ul className="mt-4 space-y-3">
							{subscription.licences.map((l) => {
								const { label, Icon } = LICENCE_LABEL[l.appAccess] ?? { label: l.appAccess, Icon: Laptop };
								return (
									<li key={l.appAccess} className="flex items-center justify-between gap-3">
										<span className="flex items-center gap-2 text-sm text-slate-700">
											<Icon className="h-4 w-4 text-slate-400" aria-hidden="true" /> {label}
										</span>
										<span className="text-sm font-semibold tabular-nums text-slate-900">
											{l.used} of {l.total} in use
										</span>
									</li>
								);
							})}
						</ul>
					) : (
						<p className="mt-4 text-sm text-slate-700">
							{subscription.seatsUsed}
							{subscription.seatLimit != null ? ` of ${subscription.seatLimit}` : ''} users
						</p>
					)}
				</section>
			</div>

			<section aria-label="Modules" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<h2 className="text-sm font-bold text-slate-800">Modules</h2>
				<p className="mt-0.5 text-xs text-slate-500">
					Billing, job cards, customers, invoices, staff and standard reports are in every plan. These depend on your plan and add-ons:
				</p>
				<ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{MODULES.map((m) => {
						const on = isFeatureOn(subscription.features, true, m.key);
						return (
							<li key={m.key} className={cn('flex items-center gap-2 text-sm', on ? 'text-slate-800' : 'text-slate-400')}>
								{on ? (
									<CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Included" />
								) : (
									<MinusCircle className="h-4 w-4 text-slate-300" aria-label="Not included" />
								)}
								{m.label}
							</li>
						);
					})}
				</ul>
			</section>

			{isOwner ? (
				<OwnerBillingPanel />
			) : (
				<p className="text-xs text-slate-500">The Owner can change the plan, add user licences and pay invoices here.</p>
			)}
		</div>
	);
}

function Header() {
	return (
		<div>
			<h1 className="text-2xl font-bold text-slate-800 tracking-tight">Subscription</h1>
			<p className="text-xs text-slate-500 mt-0.5">Your Trovo plan, user licences and modules</p>
		</div>
	);
}
