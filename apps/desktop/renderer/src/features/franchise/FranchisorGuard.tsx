import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useFranchiseAccess } from './useFranchiseAccess';

/** Lets only a company with the Franchise add-on through to the franchisor pages. */
export function FranchisorGuard({ children }: { children: ReactNode }) {
	const { canActAsFranchisor, isLoading } = useFranchiseAccess();

	if (isLoading) {
		return <p className="p-6 text-sm text-slate-500">Loading…</p>;
	}

	if (!canActAsFranchisor) {
		return (
			<div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
				<h1 className="mb-1 text-base font-semibold text-slate-900">The Franchise add-on is not active</h1>
				<p>
					This section is for companies that give franchises to others. Contact your administrator to switch the Franchise add-on on for
					your company. If your company is a franchisee, you can review what you share under{' '}
					<Link to="/settings/franchise-sharing" className="font-semibold text-teal-700 underline">
						Settings → Franchise Sharing
					</Link>
					.
				</p>
			</div>
		);
	}

	return <>{children}</>;
}
