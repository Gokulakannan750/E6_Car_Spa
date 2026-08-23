import { useState, useEffect, useCallback } from 'react';
import {
	getUsers,
	getAvailablePermissions,
	toggleUserStatus,
	type UserItemDto,
	type PermissionGroupDetailDto,
} from '../../lib/api';
import { useAuth } from '../auth/auth-context';
import { UserForm } from './UserForm';
import {
	UserPlus,
	Edit2,
	Power,
	Shield,
	User as UserIcon,
	Users as UsersIcon,
	Search,
	CheckCircle2,
	XCircle,
	KeyRound,
} from 'lucide-react';

export default function UsersManagementPage() {
	const { user: currentUser, hasPermission } = useAuth();
	const [users, setUsers] = useState<UserItemDto[]>([]);
	const [permissionGroups, setPermissionGroups] = useState<PermissionGroupDetailDto[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const [searchQuery, setSearchQuery] = useState('');

	// Modal state
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [editingUser, setEditingUser] = useState<UserItemDto | null>(null);

	const canCreate = hasPermission('users.create');
	const canEdit = hasPermission('users.edit');
	const canDeactivate = hasPermission('users.deactivate');

	const loadData = useCallback(async () => {
		setIsLoading(true);
		setError('');
		try {
			const [usersData, permsData] = await Promise.all([
				getUsers(),
				getAvailablePermissions(),
			]);
			setUsers(usersData);
			setPermissionGroups(permsData);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Failed to load users.');
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const handleOpenCreate = () => {
		setEditingUser(null);
		setIsFormOpen(true);
	};

	const handleOpenEdit = (user: UserItemDto) => {
		setEditingUser(user);
		setIsFormOpen(true);
	};

	const handleToggleStatus = async (user: UserItemDto) => {
		if (user.role === 'Owner') {
			alert('Owner account cannot be deactivated.');
			return;
		}

		if (user.id === currentUser?.id) {
			alert('You cannot deactivate your own account.');
			return;
		}

		const action = user.isActive ? 'deactivate' : 'activate';
		if (!confirm(`Are you sure you want to ${action} ${user.fullName} (@${user.username})?`)) {
			return;
		}

		try {
			await toggleUserStatus(user.id);
			await loadData();
		} catch (err: unknown) {
			alert(err instanceof Error ? err.message : `Failed to ${action} user.`);
		}
	};

	const filteredUsers = users.filter((u) => {
		const q = searchQuery.toLowerCase().trim();
		if (!q) return true;
		return (
			u.fullName.toLowerCase().includes(q) ||
			u.username.toLowerCase().includes(q) ||
			u.role.toLowerCase().includes(q) ||
			(u.email && u.email.toLowerCase().includes(q))
		);
	});

	const getRoleBadge = (role: string) => {
		switch (role) {
			case 'Owner':
				return (
					<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
						<Shield className="w-3 h-3" />
						Owner
					</span>
				);
			case 'Manager':
				return (
					<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
						<KeyRound className="w-3 h-3" />
						Manager
					</span>
				);
			case 'Staff':
			default:
				return (
					<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
						<UserIcon className="w-3 h-3" />
						Staff
					</span>
				);
		}
	};

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
						<UsersIcon className="w-7 h-7 text-blue-600" />
						Users & Permissions
					</h1>
					<p className="text-sm text-slate-500 mt-1">
						Manage staff accounts, assign granular module permissions, and oversee system access.
					</p>
				</div>

				{canCreate && (
					<button
						onClick={handleOpenCreate}
						className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow"
					>
						<UserPlus className="w-4 h-4" />
						Add User
					</button>
				)}
			</div>

			{/* Search and Filters Bar */}
			<div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
				<div className="relative flex-1 max-w-md">
					<Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search users by name, username, or role..."
						className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
					/>
				</div>

				<div className="text-xs text-slate-500 font-medium">
					Showing <span className="font-bold text-slate-800">{filteredUsers.length}</span> user{filteredUsers.length === 1 ? '' : 's'}
				</div>
			</div>

			{/* Error Notice */}
			{error && (
				<div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
					{error}
				</div>
			)}

			{/* Users Table */}
			<div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
				{isLoading ? (
					<div className="p-12 text-center text-slate-400">
						<div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent mx-auto mb-3" />
						<p className="text-sm">Loading users and permissions...</p>
					</div>
				) : filteredUsers.length === 0 ? (
					<div className="p-12 text-center text-slate-400">
						<UsersIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
						<p className="text-base font-semibold text-slate-700">No users found</p>
						<p className="text-xs text-slate-400 mt-1">
							{searchQuery ? 'Try modifying your search filter.' : 'Click "+ Add User" to create the first user.'}
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm border-collapse">
							<thead>
								<tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-600">
									<th className="py-3.5 px-4">Name</th>
									<th className="py-3.5 px-4">Username</th>
									<th className="py-3.5 px-4">Role</th>
									<th className="py-3.5 px-4">Status</th>
									<th className="py-3.5 px-4">Permissions</th>
									<th className="py-3.5 px-4">Last Login</th>
									<th className="py-3.5 px-4 text-right">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{filteredUsers.map((u) => {
									const isCurrentOwner = u.role === 'Owner';
									const isSelf = u.id === currentUser?.id;

									return (
										<tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
											<td className="py-3.5 px-4">
												<div>
													<p className="font-semibold text-slate-900">{u.fullName}</p>
													{u.email && (
														<p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
													)}
												</div>
											</td>
											<td className="py-3.5 px-4 font-mono text-xs text-slate-600">
												@{u.username}
											</td>
											<td className="py-3.5 px-4">
												{getRoleBadge(u.role)}
											</td>
											<td className="py-3.5 px-4">
												{u.isActive ? (
													<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
														<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
														Active
													</span>
												) : (
													<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
														<XCircle className="w-3.5 h-3.5 text-slate-400" />
														Inactive
													</span>
												)}
											</td>
											<td className="py-3.5 px-4 text-xs text-slate-600">
												{isCurrentOwner ? (
													<span className="font-semibold text-purple-700">Full Access (All Modules)</span>
												) : (
													<span>
														<strong className="text-slate-800">{u.permissions?.length || 0}</strong> granted
													</span>
												)}
											</td>
											<td className="py-3.5 px-4 text-xs text-slate-500">
												{u.lastLoginAt
													? new Date(u.lastLoginAt).toLocaleString(undefined, {
															year: 'numeric',
															month: 'short',
															day: 'numeric',
															hour: '2-digit',
															minute: '2-digit',
													  })
													: <span className="text-slate-400 italic">Never</span>}
											</td>
											<td className="py-3.5 px-4 text-right">
												<div className="flex items-center justify-end gap-1.5">
													{canEdit && (
														<button
															onClick={() => handleOpenEdit(u)}
															title="Edit user"
															className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
														>
															<Edit2 className="w-4 h-4" />
														</button>
													)}

													{canDeactivate && !isCurrentOwner && !isSelf && (
														<button
															onClick={() => handleToggleStatus(u)}
															title={u.isActive ? 'Deactivate user' : 'Activate user'}
															className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
																u.isActive
																	? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
																	: 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
															}`}
														>
															<Power className="w-4 h-4" />
														</button>
													)}
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* User Form Modal */}
			{isFormOpen && (
				<UserForm
					user={editingUser}
					permissionGroups={permissionGroups}
					onClose={() => setIsFormOpen(false)}
					onSuccess={async () => {
						setIsFormOpen(false);
						await loadData();
					}}
				/>
			)}
		</div>
	);
}
