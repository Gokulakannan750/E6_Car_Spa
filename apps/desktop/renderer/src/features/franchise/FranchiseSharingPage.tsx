import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2Off } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { Button, Switch } from '../../components/ui';
import { useAuth } from '../auth/auth-context';
import { decideFranchiseScope, endFranchiseLink, getFranchiseNetwork, type FranchiseLinkDto } from '../../lib/api';
import { Card, errorText, FRANCHISE_QUERY_KEY, PartnerHeader } from './FranchisePage';
import { FRANCHISE_ACCESS_QUERY_KEY } from './useFranchiseAccess';

/**
 * For a company that is a franchisee: who can see what about it, with a switch for each item and a way to end the
 * link. It is a small page in Settings, not a section of its own: a franchisee answers invitations through the link
 * it is sent.
 */
export function FranchiseSharingPage() {
	const { hasPermission } = useAuth();
	const canManage = hasPermission('franchise.manage');
	const queryClient = useQueryClient();
	const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

	const network = useQuery({ queryKey: FRANCHISE_QUERY_KEY, queryFn: getFranchiseNetwork, refetchOnWindowFocus: true });

	const run = async (action: () => Promise<unknown>, success?: string) => {
		setNotice(null);
		try {
			await action();
			await queryClient.invalidateQueries({ queryKey: FRANCHISE_QUERY_KEY });
			await queryClient.invalidateQueries({ queryKey: FRANCHISE_ACCESS_QUERY_KEY });
			if (success) setNotice({ kind: 'ok', text: success });
		} catch (err) {
			setNotice({ kind: 'error', text: errorText(err) });
		}
	};

	const links = (network.data?.franchisors ?? []).filter((l) => l.status === 'Active');
	const waiting = (network.data?.franchisors ?? []).filter((l) => l.status === 'Pending').length;

	return (
		<div className="space-y-6 max-w-3xl mx-auto">
			<PageHeader
				title="Franchise Sharing"
				description="The companies that franchise you, and exactly what each can see about your company. Switch anything off at any time."
			/>

			{notice && (
				<div
					role={notice.kind === 'error' ? 'alert' : 'status'}
					className={`rounded-lg border px-4 py-3 text-sm ${
						notice.kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
					}`}
				>
					{notice.text}
				</div>
			)}

			{network.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
			{network.isError && <p className="text-sm text-red-600">{errorText(network.error)}</p>}

			{network.data && links.length === 0 && (
				<p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
					No company franchises you at the moment, so nothing is being shared.
				</p>
			)}

			{waiting > 0 && (
				<p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
					You have an invitation waiting. Open the link you were sent to answer it.
				</p>
			)}

			{links.map((link) => (
				<SharingCard
					key={link.id}
					link={link}
					canManage={canManage}
					onToggle={(scope, grant) => run(() => decideFranchiseScope(link.id, scope, grant))}
					onEnd={() => {
						if (confirm(`End the franchise link with ${link.partnerName}? They will stop seeing your figures at once.`)) {
							return run(() => endFranchiseLink(link.id), 'Franchise link ended.');
						}
					}}
				/>
			))}
		</div>
	);
}

function SharingCard({
	link,
	canManage,
	onToggle,
	onEnd,
}: {
	link: FranchiseLinkDto;
	canManage: boolean;
	onToggle: (scope: string, grant: boolean) => void;
	onEnd: () => void;
}) {
	return (
		<Card>
			<PartnerHeader link={link} />
			<p className="text-sm text-slate-600">What {link.partnerName} can see about your company:</p>
			<ul className="space-y-2">
				{link.scopes.map((s) => (
					<li key={s.scope} className="flex items-center justify-between gap-3 text-sm">
						<span className="text-slate-700">
							{s.label}
							{s.status === 'Requested' && (
								<em className="ml-2 text-xs not-italic font-semibold text-amber-700">Asked for, open the link you were sent to answer</em>
							)}
						</span>
						<Switch
							aria-label={s.label}
							checked={s.status === 'Granted'}
							disabled={!canManage || s.status === 'Requested'}
							onChange={(e) => onToggle(s.scope, e.target.checked)}
						/>
					</li>
				))}
			</ul>
			{canManage && (
				<Button variant="ghost" size="sm" icon={<Link2Off className="h-4 w-4" />} onClick={onEnd}>
					End link
				</Button>
			)}
		</Card>
	);
}

export default FranchiseSharingPage;
