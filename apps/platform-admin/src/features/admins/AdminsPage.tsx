import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, UserCheck, UserX } from 'lucide-react';
import { useBreadcrumbs } from '@/app/layout/Breadcrumbs';
import { Button, IconButton } from '@/components/Button';
import { OneTimeValue } from '@/components/CopyButton';
import { SelectField, TextField } from '@/components/Field';
import { Modal } from '@/components/Modal';
import { ReasonDialog } from '@/components/ReasonDialog';
import { Badge, RoleBadge } from '@/components/StatusBadge';
import { Card, EmptyState, ErrorState, InlineError, LoadingState, PageHeader } from '@/components/Surface';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { date, dateTime } from '@/lib/format';
import type { AdminListItem, AdminRole } from '@/lib/types';

const ROLES: { role: AdminRole; text: string }[] = [
	{ role: 'Owner', text: 'Everything, including admins, the audit log and database updates' },
	{ role: 'Billing', text: 'Plans, prices, subscriptions, invoices and payments' },
	{ role: 'Support', text: 'Companies, registration codes, suspend and reactivate' },
	{ role: 'ReadOnly', text: 'Can look at everything except owner pages; changes nothing' },
];

type Pending = { kind: 'role'; admin: AdminListItem; role: AdminRole } | { kind: 'active'; admin: AdminListItem } | { kind: 'reset'; admin: AdminListItem } | null;

export function AdminsPage() {
	useBreadcrumbs({ label: 'Admins' });
	const { session } = useAuth();
	const toast = useToast();
	const queryClient = useQueryClient();
	const admins = useQuery({ queryKey: ['admins'], queryFn: api.admins });
	const [adding, setAdding] = useState(false);
	const [pending, setPending] = useState<Pending>(null);
	const [oneTime, setOneTime] = useState<{ email: string; password: string; created: boolean } | null>(null);

	const update = useMutation({
		mutationFn: ({ id, reason, role, isActive }: { id: string; reason: string; role?: AdminRole; isActive?: boolean }) => api.updateAdmin(id, { role, isActive, reason }),
		onSuccess: (admin) => {
			queryClient.invalidateQueries({ queryKey: ['admins'] });
			toast.success(`${admin.email} updated.`);
			setPending(null);
		},
	});
	const reset = useMutation({
		mutationFn: ({ id, reason }: { id: string; reason: string }) => api.resetAdmin(id, reason),
		onSuccess: (result, vars) => {
			queryClient.invalidateQueries({ queryKey: ['admins'] });
			const admin = admins.data?.find((a) => a.id === vars.id);
			setPending(null);
			setOneTime({ email: admin?.email ?? '', password: result.oneTimePassword, created: false });
		},
	});

	useEffect(() => {
		update.reset();
		reset.reset();
	}, [pending]);

	const me = session?.admin.id;

	return (
		<>
			<PageHeader
				title="Admins"
				description="Trovo staff who can use this console. Everyone signs in with a password and an authenticator app."
				actions={
					<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
						Add admin
					</Button>
				}
			/>
			<Card>
				{admins.isPending ? (
					<LoadingState />
				) : admins.isError ? (
					<ErrorState error={admins.error} onRetry={() => admins.refetch()} />
				) : admins.data.length === 0 ? (
					<EmptyState title="No admins" />
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-table">
							<thead>
								<tr className="border-b border-border-subtle text-left text-label font-semibold tracking-[0.04em] whitespace-nowrap text-text-muted uppercase">
									<th className="h-10 px-4">Admin</th>
									<th className="h-10 px-4">Role</th>
									<th className="h-10 px-4">Sign-in</th>
									<th className="h-10 px-4">Last sign-in</th>
									<th className="h-10 px-4">Added</th>
									<th className="h-10 px-4 text-right">Actions</th>
								</tr>
							</thead>
							<tbody>
								{admins.data.map((a) => {
									const self = a.id === me;
									return (
										<tr key={a.id} className={`h-12 border-b border-border-hairline last:border-b-0 ${a.isActive ? '' : 'text-text-muted'}`}>
											<td className="px-4 py-2">
												<div className="font-medium text-text-heading">
													{a.name || a.email}
													{self && <span className="ml-2 text-micro text-text-muted">(you)</span>}
												</div>
												<div className="text-micro text-text-muted">{a.email}</div>
											</td>
											<td className="px-4 py-2">
												{self ? (
													<RoleBadge role={a.role} />
												) : (
													<SelectField
														aria-label={`Role for ${a.email}`}
														value={a.role}
														disabled={!a.isActive}
														onChange={(e) => setPending({ kind: 'role', admin: a, role: e.target.value as AdminRole })}
														containerClassName="w-36"
														className="h-8 text-label"
													>
														{ROLES.map((r) => (
															<option key={r.role} value={r.role}>
																{r.role === 'ReadOnly' ? 'Read-only' : r.role}
															</option>
														))}
													</SelectField>
												)}
											</td>
											<td className="px-4 py-2">
												{!a.isActive ? (
													<Badge tone="canceled">Switched off</Badge>
												) : a.mustChangePassword || !a.totpConfirmed ? (
													<Badge tone="pastdue">Setup pending</Badge>
												) : (
													<Badge tone="active">Ready</Badge>
												)}
											</td>
											<td className="tabular px-4 py-2 whitespace-nowrap text-text-secondary">{a.lastSignInAt ? dateTime(a.lastSignInAt) : 'Never'}</td>
											<td className="tabular px-4 py-2 whitespace-nowrap text-text-secondary">{date(a.createdAt)}</td>
											<td className="px-4 py-2">
												{!self && (
													<div className="flex justify-end gap-1">
														<IconButton label={`Reset sign-in for ${a.email}`} disabled={!a.isActive} onClick={() => setPending({ kind: 'reset', admin: a })}>
															<KeyRound className="size-4" />
														</IconButton>
														<IconButton
															label={a.isActive ? `Switch off ${a.email}` : `Switch on ${a.email}`}
															onClick={() => setPending({ kind: 'active', admin: a })}
															className={a.isActive ? 'hover:text-danger' : ''}
														>
															{a.isActive ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
														</IconButton>
													</div>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</Card>

			<Card className="mt-6 p-5">
				<h2 className="mb-3 text-title font-semibold text-text-heading">Roles</h2>
				<ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
					{ROLES.map((r) => (
						<li key={r.role} className="flex items-start gap-3">
							<RoleBadge role={r.role} />
							<span className="text-label text-text-secondary">{r.text}</span>
						</li>
					))}
				</ul>
			</Card>

			<AddAdminDialog
				open={adding}
				onClose={() => setAdding(false)}
				onCreated={(email, password) => {
					setAdding(false);
					setOneTime({ email, password, created: true });
				}}
			/>

			<ReasonDialog
				open={pending?.kind === 'role'}
				onClose={() => setPending(null)}
				title="Change role?"
				description={pending?.kind === 'role' ? `${pending.admin.email}: ${pending.admin.role} → ${pending.role}` : undefined}
				confirmLabel="Change role"
				busy={update.isPending}
				error={update.error?.message}
				onConfirm={(reason) => pending?.kind === 'role' && update.mutate({ id: pending.admin.id, role: pending.role, reason })}
			>
				<p className="text-body text-text-secondary">The new role applies the next time they sign in.</p>
			</ReasonDialog>

			<ReasonDialog
				open={pending?.kind === 'active'}
				onClose={() => setPending(null)}
				tone={pending?.kind === 'active' && pending.admin.isActive ? 'danger' : 'primary'}
				title={pending?.kind === 'active' && pending.admin.isActive ? 'Switch off this admin?' : 'Switch this admin back on?'}
				description={pending?.kind === 'active' ? pending.admin.email : undefined}
				confirmLabel={pending?.kind === 'active' && pending.admin.isActive ? 'Switch off' : 'Switch on'}
				quickReasons={pending?.kind === 'active' && pending.admin.isActive ? ['Left Trovo', 'Role no longer needed', 'Security concern'] : []}
				busy={update.isPending}
				error={update.error?.message}
				onConfirm={(reason) => pending?.kind === 'active' && update.mutate({ id: pending.admin.id, isActive: !pending.admin.isActive, reason })}
			>
				<p className="text-body text-text-secondary">
					{pending?.kind === 'active' && pending.admin.isActive
						? 'They cannot sign in any more; a session they already have ends when it expires (within 2 hours). Nothing they did is removed.'
						: 'They can sign in again with their current password and authenticator.'}
				</p>
			</ReasonDialog>

			<ReasonDialog
				open={pending?.kind === 'reset'}
				onClose={() => setPending(null)}
				tone="danger"
				title="Reset sign-in?"
				description={pending?.kind === 'reset' ? pending.admin.email : undefined}
				confirmLabel="Reset"
				quickReasons={['Forgot password', 'Lost phone', 'New phone']}
				busy={reset.isPending}
				error={reset.error?.message}
				onConfirm={(reason) => pending?.kind === 'reset' && reset.mutate({ id: pending.admin.id, reason })}
			>
				<p className="text-body text-text-secondary">
					Their password is replaced by a one-time password and they set up their authenticator again. Give them the one-time password in person or by phone.
				</p>
			</ReasonDialog>

			<Modal
				open={oneTime !== null}
				onClose={() => setOneTime(null)}
				dismissable={false}
				width="sm"
				title={oneTime?.created ? 'Admin added' : 'Sign-in reset'}
				description="Give this one-time password to them in person or by phone, not by email. It is shown only now."
				footer={
					<Button variant="primary" onClick={() => setOneTime(null)}>
						Done
					</Button>
				}
			>
				{oneTime && (
					<div className="flex flex-col gap-3">
						<OneTimeValue label="Email" value={oneTime.email} />
						<OneTimeValue label="One-time password" value={oneTime.password} />
						<p className="text-label text-text-secondary">At first sign-in they set up an authenticator app and choose their own password.</p>
					</div>
				)}
			</Modal>
		</>
	);
}

function AddAdminDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (email: string, password: string) => void }) {
	const queryClient = useQueryClient();
	const [email, setEmail] = useState('');
	const [name, setName] = useState('');
	const [role, setRole] = useState<AdminRole>('Support');
	const [errors, setErrors] = useState<{ email?: string; name?: string }>({});
	const create = useMutation({
		mutationFn: () => api.createAdmin(email.trim(), name.trim(), role),
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ['admins'] });
			onCreated(result.admin.email, result.oneTimePassword);
		},
	});
	useEffect(() => {
		if (open) {
			setEmail('');
			setName('');
			setRole('Support');
			setErrors({});
			create.reset();
		}
	}, [open]);

	function submit(event: FormEvent) {
		event.preventDefault();
		const next: typeof errors = {};
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.';
		if (!name.trim()) next.name = 'Enter their name.';
		setErrors(next);
		if (Object.keys(next).length === 0) create.mutate();
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			width="sm"
			title="Add admin"
			description="They get a one-time password; at first sign-in they set up an authenticator app and their own password."
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="add-admin" variant="primary" loading={create.isPending}>
						Add admin
					</Button>
				</>
			}
		>
			<form id="add-admin" onSubmit={submit} noValidate className="flex flex-col gap-4">
				<TextField label="Name" maxLength={150} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
				<TextField label="Email" type="email" maxLength={150} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
				<SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value as AdminRole)} hint={ROLES.find((r) => r.role === role)?.text}>
					{ROLES.map((r) => (
						<option key={r.role} value={r.role}>
							{r.role === 'ReadOnly' ? 'Read-only' : r.role}
						</option>
					))}
				</SelectField>
				<InlineError message={create.error?.message} />
			</form>
		</Modal>
	);
}
