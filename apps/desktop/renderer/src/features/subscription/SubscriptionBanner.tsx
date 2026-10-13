import { AlertTriangle, ChevronRight, Info, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { cn } from '../../utils/cn';

const STYLES = {
	info: { box: 'bg-blue-50 border-blue-200 text-blue-900', Icon: Info },
	warning: { box: 'bg-amber-50 border-amber-200 text-amber-900', Icon: AlertTriangle },
	error: { box: 'bg-red-50 border-red-200 text-red-900', Icon: Lock },
} as const;

/**
 * The subscription message from the server (trial ending, payment overdue, read-only), shown above every page.
 * Nothing is shown on a single-company server or while the subscription is fine.
 */
export function SubscriptionBanner() {
	const { subscription } = useAuth();
	const banner = subscription?.banner;
	if (!banner) return null;

	const style = STYLES[banner.level] ?? STYLES.info;
	return (
		<div role="status" className={cn('flex items-center gap-2.5 border-b px-6 py-2 text-sm font-medium', style.box)}>
			<style.Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
			<span>{banner.message}</span>
			{subscription?.planChangePending && (
				<Link to="/settings/subscription" className="ml-auto inline-flex items-center gap-0.5 font-semibold underline-offset-2 hover:underline">
					Review <ChevronRight className="h-4 w-4" aria-hidden="true" />
				</Link>
			)}
		</div>
	);
}
