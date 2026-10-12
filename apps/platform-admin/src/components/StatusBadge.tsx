// Status pills: tinted background, bright text and a leading dot, as in the Stitch design.

type Tone = 'trial' | 'active' | 'pastdue' | 'readonly' | 'suspended' | 'canceled' | 'registration' | 'neutral' | 'info';

const tones: Record<Tone, string> = {
	trial: 'bg-trial-bg text-trial',
	active: 'bg-active-bg text-active',
	pastdue: 'bg-pastdue-bg text-pastdue',
	readonly: 'bg-readonly-bg text-readonly',
	suspended: 'bg-suspended-bg text-suspended',
	canceled: 'bg-canceled-bg text-canceled',
	registration: 'bg-registration-bg text-registration',
	neutral: 'bg-canceled-bg text-text-secondary',
	info: 'bg-trial-bg text-trial',
};

export function Badge({ tone, children, dot = true }: { tone: Tone; children: React.ReactNode; dot?: boolean }) {
	return (
		<span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-micro font-medium whitespace-nowrap ${tones[tone]}`}>
			{dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
			{children}
		</span>
	);
}

const subscriptionTones: Record<string, [Tone, string]> = {
	Trialing: ['trial', 'Trial'],
	Active: ['active', 'Active'],
	PastDue: ['pastdue', 'Past due'],
	ReadOnly: ['readonly', 'Read-only'],
	Suspended: ['suspended', 'Suspended'],
	Canceled: ['canceled', 'Canceled'],
	Incomplete: ['neutral', 'Incomplete'],
};

/** A company's state: waiting for first registration, suspended by Trovo, or its subscription status. */
export function CompanyStatusBadge({ companyStatus, subscriptionStatus }: { companyStatus: string; subscriptionStatus: string | null }) {
	if (companyStatus === 'AwaitingRegistration') return <Badge tone="registration">Awaiting registration</Badge>;
	if (companyStatus === 'Suspended' && subscriptionStatus !== 'Suspended') return <Badge tone="suspended">Suspended</Badge>;
	return <SubscriptionStatusBadge status={subscriptionStatus} />;
}

export function SubscriptionStatusBadge({ status }: { status: string | null }) {
	if (!status) return <Badge tone="neutral">No subscription</Badge>;
	const [tone, label] = subscriptionTones[status] ?? ['neutral', status];
	return <Badge tone={tone}>{label}</Badge>;
}

export function InvoiceStatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
	if (overdue && status === 'Open') return <Badge tone="suspended">Overdue</Badge>;
	switch (status) {
		case 'Paid':
			return <Badge tone="active">Paid</Badge>;
		case 'Open':
			return <Badge tone="pastdue">Open</Badge>;
		case 'Void':
			return <Badge tone="canceled">Void</Badge>;
		case 'Uncollectible':
			return <Badge tone="suspended">Uncollectible</Badge>;
		case 'Draft':
			return <Badge tone="neutral">Draft</Badge>;
		default:
			return <Badge tone="neutral">{status}</Badge>;
	}
}

const roleTones: Record<string, Tone> = { Owner: 'registration', Billing: 'active', Support: 'trial', ReadOnly: 'neutral' };

export function RoleBadge({ role }: { role: string }) {
	return (
		<Badge tone={roleTones[role] ?? 'neutral'} dot={false}>
			{role === 'ReadOnly' ? 'Read-only' : role}
		</Badge>
	);
}
