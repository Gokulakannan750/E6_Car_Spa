import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { AuthLayout } from './AuthLayout';
import { useAuth } from './AuthProvider';
import { ChangePasswordForm } from './ChangePasswordForm';

/** First sign-in (or after an owner reset): the API refuses everything else until the password is changed. */
export function ChangePasswordPage() {
	const { session, signedIn, signOut } = useAuth();
	const navigate = useNavigate();

	if (!session) return <Navigate to="/sign-in" replace />;
	if (!session.admin.mustChangePassword) return <Navigate to="/dashboard" replace />;

	return (
		<AuthLayout title="Choose a new password" subtitle="You signed in with a one-time password. Set your own password to continue.">
			<ChangePasswordForm
				submitLabel="Save and continue"
				onChanged={(s) => {
					signedIn(s);
					navigate('/dashboard', { replace: true });
				}}
			/>
			<Button variant="ghost" className="mt-2 w-full" onClick={() => signOut()}>
				Sign out
			</Button>
		</AuthLayout>
	);
}
