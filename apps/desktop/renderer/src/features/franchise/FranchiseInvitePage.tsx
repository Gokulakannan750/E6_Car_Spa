import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Network, Check, X } from 'lucide-react';
import { Button, Checkbox } from '../../components/ui';
import { useAuth } from '../auth/auth-context';
import { getFranchiseInviteByToken, respondToFranchiseInviteByToken, type FranchiseLinkDto } from '../../lib/api';
import { FRANCHISE_ACCESS_QUERY_KEY } from './useFranchiseAccess';

function errorText(err: unknown) {
	return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen w-full bg-slate-50 px-4 py-10">
			<div className="mx-auto max-w-xl space-y-4">{children}</div>
		</div>
	);
}

/**
 * Where the Owner of the invited company lands from the link a franchisor sent. The route needs a signed-in user with
 * permission to manage the franchise network; the server then checks that the link belongs to this company.
 */
export function FranchiseInvitePage() {
	const { token = '' } = useParams();
	const { logout, user } = useAuth();
	const queryClient = useQueryClient();
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState<null | { accepted: boolean; partner: string; isRequest: boolean }>(null);
	const [allowed, setAllowed] = useState<string[] | null>(null);
	const [saving, setSaving] = useState(false);

	const invite = useQuery({
		queryKey: ['franchise-invite', token],
		queryFn: () => getFranchiseInviteByToken(token),
		retry: false,
	});

	const link: FranchiseLinkDto | undefined = invite.data;
	const isRequest = link?.status === 'Active';
	// What is being asked now: everything on a new invitation, only the new requests on an active link.
	const asked = (link?.scopes ?? []).filter((s) => !isRequest || s.status === 'Requested');
	const ticked = allowed ?? asked.map((s) => s.scope);

	const toggle = (scope: string) =>
		setAllowed((current) => {
			const base = current ?? asked.map((s) => s.scope);
			return base.includes(scope) ? base.filter((s) => s !== scope) : [...base, scope];
		});

	const answer = async (accept: boolean) => {
		if (!link) return;
		setSaving(true);
		setError(null);
		try {
			await respondToFranchiseInviteByToken(token, { accept, grantedScopes: accept ? ticked : [] });
			await queryClient.invalidateQueries({ queryKey: FRANCHISE_ACCESS_QUERY_KEY });
			setDone({ accepted: accept, partner: link.partnerName, isRequest });
		} catch (err) {
			setError(errorText(err));
		} finally {
			setSaving(false);
		}
	};

	if (invite.isLoading) {
		return (
			<Shell>
				<p className="text-sm text-slate-500">Opening the invitation…</p>
			</Shell>
		);
	}

	if (invite.isError || !link) {
		return (
			<Shell>
				<div role="alert" className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
					<h1 className="text-base font-semibold text-slate-900">This link cannot be opened</h1>
					<p>{errorText(invite.error)}</p>
					<p className="text-xs text-slate-500">
						The link works only for the Owner of the company that was invited, once, before it expires. You are signed in as{' '}
						{user?.fullName ?? 'someone'}. If that is not the Owner of the invited company, sign in again, or ask the sender for a new link.
					</p>
					<div className="flex gap-2">
						<Button variant="secondary" onClick={() => logout()}>
							Sign in as someone else
						</Button>
						<Link to="/dashboard" className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
							Go to the app
						</Link>
					</div>
				</div>
			</Shell>
		);
	}

	if (done) {
		return (
			<Shell>
				<div role="status" className="space-y-3 rounded-xl border border-emerald-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
					<h1 className="text-base font-semibold text-slate-900">
						{done.accepted ? 'Thank you, your answer was saved' : 'You declined'}
					</h1>
					<p>
						{done.accepted
							? `${done.partner} can now see only what you allowed.`
							: done.isRequest
								? `${done.partner} was not given anything new.`
								: `${done.partner} was not given access to anything.`}
					</p>
					{done.accepted && (
						<p>
							You can review or stop sharing at any time under <strong>Settings → Franchise Sharing</strong>.
						</p>
					)}
					<Link to="/dashboard" className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
						Go to the app
					</Link>
				</div>
			</Shell>
		);
	}

	return (
		<Shell>
			<div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
						<Network className="h-5 w-5" />
					</div>
					<div>
						<h1 className="text-base font-semibold text-slate-900">
							{isRequest ? 'A request to see more' : 'Franchise invitation'}
						</h1>
						<p className="text-xs text-slate-500">
							From {link.partnerName} (company code {link.partnerCodeHint})
						</p>
					</div>
				</div>

				<p className="text-sm text-slate-700">
					{isRequest ? (
						<>
							<strong>{link.partnerName}</strong>, which already franchises your company, is asking to see more. Tick only what you are
							happy to share.
						</>
					) : (
						<>
							<strong>{link.partnerName}</strong> invites you to join their franchise network. If you accept, they can see only what you
							allow below. You can switch any of it off later. The invitation expires on{' '}
							{new Date(link.expiresAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}.
						</>
					)}
				</p>

				<fieldset className="space-y-1.5">
					<legend className="mb-1 text-xs font-semibold text-slate-600">They are asking to see:</legend>
					{asked.map((s) => (
						<div key={s.scope}>
							<Checkbox label={s.label} checked={ticked.includes(s.scope)} onChange={() => toggle(s.scope)} />
						</div>
					))}
				</fieldset>

				{error && (
					<p role="alert" className="text-sm text-red-600">
						{error}
					</p>
				)}

				<div className="flex flex-wrap gap-2">
					<Button icon={<Check className="h-4 w-4" />} loading={saving} disabled={!isRequest && ticked.length === 0} onClick={() => answer(true)}>
						{isRequest ? 'Allow the ticked items' : 'Accept'}
					</Button>
					<Button variant="secondary" icon={<X className="h-4 w-4" />} disabled={saving} onClick={() => answer(false)}>
						{isRequest ? "Don't allow" : 'Decline'}
					</Button>
				</div>
			</div>
		</Shell>
	);
}

export default FranchiseInvitePage;
