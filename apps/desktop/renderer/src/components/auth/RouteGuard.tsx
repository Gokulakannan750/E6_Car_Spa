import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/auth-context';
import { AccessDenied } from './AccessDenied';

interface RouteGuardProps {
	children: ReactNode;
	requiredPermission?: string | string[];
	/** A plan feature the page needs (on Trovo's platform). */
	requiredFeature?: string;
}

export function RouteGuard({ children, requiredPermission, requiredFeature }: RouteGuardProps) {
	const { isAuthenticated, isInitialized, isLoading, hasPermission, hasFeature } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return (
			<div className="flex h-screen w-screen items-center justify-center bg-slate-50">
				<div className="flex flex-col items-center gap-3">
					<div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
					<p className="text-sm font-medium text-slate-500">Loading...</p>
				</div>
			</div>
		);
	}

	if (isInitialized === false) {
		return <Navigate to="/setup" replace />;
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" state={{ from: location }} replace />;
	}

	if (requiredFeature && hasFeature && !hasFeature(requiredFeature)) {
		return (
			<div className="flex h-full items-center justify-center p-10">
				<div className="max-w-md rounded-2xl border border-outline-variant bg-surface p-8 text-center shadow-sm">
					<h2 className="text-lg font-bold text-on-surface">Not included in your plan</h2>
					<p className="mt-2 text-sm text-on-surface-variant">
						This part of the software is not part of your current plan. Contact Trovo to add it.
					</p>
				</div>
			</div>
		);
	}

	if (requiredPermission) {
		const hasAccess = Array.isArray(requiredPermission)
			? requiredPermission.some((p) => hasPermission(p))
			: hasPermission(requiredPermission);
		if (!hasAccess) {
			const displayPerm = Array.isArray(requiredPermission)
				? requiredPermission.join(' or ')
				: requiredPermission;
			return <AccessDenied requiredPermission={displayPerm} />;
		}
	}

	return <>{children}</>;
}
