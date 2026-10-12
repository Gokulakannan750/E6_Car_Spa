import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import type { AdminRole } from '@/lib/types';

/** Signed-in pages: no session → sign-in; password change pending → change-password; wrong role → a clear refusal. */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: AdminRole[] }) {
	const { session } = useAuth();
	const location = useLocation();

	if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
	if (session.admin.mustChangePassword) return <Navigate to="/change-password" replace />;
	if (roles && !roles.includes(session.admin.role)) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
				<ShieldOff className="size-6 text-text-muted" aria-hidden />
				<p className="text-body font-medium text-text-primary">Not available for your role</p>
				<p className="text-label text-text-muted">Ask a Trovo owner if you need access to this page.</p>
			</div>
		);
	}
	return <>{children}</>;
}
