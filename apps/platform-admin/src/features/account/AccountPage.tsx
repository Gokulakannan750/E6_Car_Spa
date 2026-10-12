import { useBreadcrumbs } from '@/app/layout/Breadcrumbs';
import { RoleBadge } from '@/components/StatusBadge';
import { Card, CardHeader, DetailList, PageHeader } from '@/components/Surface';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import { ChangePasswordForm } from '@/features/auth/ChangePasswordForm';
import { dateTime } from '@/lib/format';

export function AccountPage() {
	useBreadcrumbs({ label: 'My account' });
	const { session, signedIn } = useAuth();
	const toast = useToast();
	if (!session) return null;
	const { admin } = session;

	return (
		<>
			<PageHeader title="My account" />
			<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
				<Card>
					<CardHeader title="Profile" subtitle="Ask a Trovo owner to change your name, email or role." />
					<div className="p-5">
						<DetailList
							items={[
								{ label: 'Name', value: admin.name || '—' },
								{ label: 'Email', value: admin.email },
								{ label: 'Role', value: <RoleBadge role={admin.role} /> },
								{ label: 'Session ends', value: `${dateTime(session.expiresAt)} (or after 30 minutes without activity)` },
							]}
						/>
					</div>
				</Card>
				<Card>
					<CardHeader title="Change password" subtitle="At least 12 characters." />
					<div className="p-5">
						<ChangePasswordForm onChanged={(s) => {
							signedIn(s);
							toast.success('Password changed.');
						}} />
					</div>
				</Card>
				<Card className="xl:col-span-2">
					<CardHeader title="Authenticator app" />
					<p className="p-5 text-body text-text-secondary">
						Every sign-in asks for a code from your authenticator app. If you lose or replace your phone, ask a Trovo owner to reset your sign-in; you will then set up the
						app again.
					</p>
				</Card>
			</div>
		</>
	);
}
