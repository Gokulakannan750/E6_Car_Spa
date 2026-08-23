import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/auth-context';
import { AccessDenied } from './AccessDenied';

interface RouteGuardProps {
	children: ReactNode;
	requiredPermission?: string;
}

export function RouteGuard({ children, requiredPermission }: RouteGuardProps) {
	const { isAuthenticated, isInitialized, isLoading, hasPermission } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return (
			<div className="flex h-screen w-screen items-center justify-center bg-slate-50">
				<div className="flex flex-col items-center gap-3">
					<div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
					<p className="text-sm font-medium text-slate-500">Loading E6 Car Spa...</p>
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

	if (requiredPermission && !hasPermission(requiredPermission)) {
		return <AccessDenied requiredPermission={requiredPermission} />;
	}

	return <>{children}</>;
}
