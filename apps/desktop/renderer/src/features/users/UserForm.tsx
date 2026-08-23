import React, { useState } from 'react';
import {
	type UserItemDto,
	type PermissionGroupDetailDto,
	createUser,
	updateUser,
	ApiError,
} from '../../lib/api';
import { PermissionSelector } from './PermissionSelector';
import { X, ShieldCheck, Check } from 'lucide-react';

interface UserFormProps {
	user?: UserItemDto | null; // If null, create mode; otherwise edit mode
	permissionGroups: PermissionGroupDetailDto[];
	onClose: () => void;
	onSuccess: () => void;
}

export function UserForm({ user, permissionGroups, onClose, onSuccess }: UserFormProps) {
	const isEdit = !!user;
	const isOwner = user?.role === 'Owner';

	const [fullName, setFullName] = useState(user?.fullName || '');
	const [username, setUsername] = useState(user?.username || '');
	const [email, setEmail] = useState(user?.email || '');
	const [role, setRole] = useState<'Manager' | 'Staff'>(
		user?.role === 'Manager' ? 'Manager' : 'Staff'
	);
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
		user?.permissions || []
	);
	const [error, setError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

		if (!fullName.trim()) {
			setError('Full name is required.');
			return;
		}

		if (!isEdit && !username.trim()) {
			setError('Username is required.');
			return;
		}

		if (!isEdit && !password) {
			setError('Password is required.');
			return;
		}

		if (password) {
			if (password.length < 8) {
				setError('Password must be at least 8 characters long.');
				return;
			}
			if (password !== confirmPassword) {
				setError('Passwords do not match.');
				return;
			}
		}

		setIsSubmitting(true);

		try {
			if (isEdit && user) {
				await updateUser(user.id, {
					fullName: fullName.trim(),
					email: email.trim() || null,
					password: password || undefined,
					confirmPassword: confirmPassword || undefined,
					role: isOwner ? 'Owner' : role,
					permissionCodes: isOwner ? undefined : selectedPermissions,
				});
			} else {
				await createUser({
					fullName: fullName.trim(),
					username: username.trim().toLowerCase(),
					email: email.trim() || null,
					password,
					confirmPassword,
					role,
					permissionCodes: selectedPermissions,
				});
			}

			onSuccess();
		} catch (err: unknown) {
			if (err instanceof ApiError) {
				setError(err.message || 'Operation failed.');
			} else if (err instanceof Error) {
				setError(err.message);
			} else {
				setError('An unexpected error occurred.');
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
			<div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
				{/* Modal Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
					<div>
						<h3 className="text-lg font-bold text-slate-900">
							{isEdit ? (isOwner ? 'Edit Owner Account' : `Edit User: ${user?.fullName}`) : 'Add New User'}
						</h3>
						<p className="text-xs text-slate-500 mt-0.5">
							{isEdit ? 'Update profile and user permissions' : 'Create a Manager or Staff account and assign permissions'}
						</p>
					</div>
					<button
						onClick={onClose}
						className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Modal Body */}
				<form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
					{error && (
						<div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
							{error}
						</div>
					)}

					{/* Owner Notice Banner */}
					{isOwner && (
						<div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
							<div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
								<ShieldCheck className="w-5 h-5 text-blue-600" />
								OWNER ACCESS
							</div>
							<ul className="text-xs text-blue-800 space-y-1 pl-1">
								<li className="flex items-center gap-1.5">
									<Check className="w-3.5 h-3.5 text-blue-600" /> Full access to all current modules
								</li>
								<li className="flex items-center gap-1.5">
									<Check className="w-3.5 h-3.5 text-blue-600" /> Automatically receives access to future modules
								</li>
								<li className="flex items-center gap-1.5">
									<Check className="w-3.5 h-3.5 text-blue-600" /> Permissions cannot restrict Owner access
								</li>
							</ul>
						</div>
					)}

					{/* Profile Inputs */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
								Full Name *
							</label>
							<input
								type="text"
								value={fullName}
								onChange={(e) => setFullName(e.target.value)}
								placeholder="e.g. Ramesh Kumar"
								required
								className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
							/>
						</div>

						<div>
							<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
								Username {isEdit ? '(Immutable)' : '*'}
							</label>
							<input
								type="text"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								placeholder="e.g. ramesh"
								required={!isEdit}
								disabled={isEdit}
								className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:opacity-60 disabled:bg-slate-100"
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
								Email Address (Optional)
							</label>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="user@e6carspa.com"
								className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
							/>
						</div>

						{!isOwner && (
							<div>
								<label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
									Role *
								</label>
								<select
									value={role}
									onChange={(e) => setRole(e.target.value as 'Manager' | 'Staff')}
									className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
								>
									<option value="Manager">Manager</option>
									<option value="Staff">Staff</option>
								</select>
							</div>
						)}
					</div>

					{/* Password Fields */}
					<div className="border-t border-slate-200 pt-4">
						<p className="text-xs font-semibold text-slate-600 mb-3">
							{isEdit ? 'Change Password (leave blank to keep current)' : 'Set Password *'}
						</p>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-xs font-medium text-slate-600 mb-1">
									Password {isEdit ? '' : '*'}
								</label>
								<input
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder={isEdit ? 'New password (min 8 chars)' : 'Min 8 characters'}
									required={!isEdit}
									minLength={password ? 8 : undefined}
									className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
								/>
							</div>

							<div>
								<label className="block text-xs font-medium text-slate-600 mb-1">
									Confirm Password {isEdit ? '' : '*'}
								</label>
								<input
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									placeholder="Confirm new password"
									required={!isEdit || !!password}
									minLength={confirmPassword ? 8 : undefined}
									className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
								/>
							</div>
						</div>
					</div>

					{/* Permission Checklist (for Manager and Staff only) */}
					{!isOwner && (
						<div className="border-t border-slate-200 pt-4">
							<div className="mb-3">
								<h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
									Assigned Permissions
								</h4>
								<p className="text-xs text-slate-500 mt-0.5">
									Select permissions granted to this user
								</p>
							</div>

							<PermissionSelector
								groups={permissionGroups}
								selected={selectedPermissions}
								onChange={setSelectedPermissions}
							/>
						</div>
					)}

					{/* Form Footer */}
					<div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
						<button
							type="button"
							onClick={onClose}
							disabled={isSubmitting}
							className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm flex items-center gap-2"
						>
							{isSubmitting ? (
								<>
									<div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
									Saving...
								</>
							) : isEdit ? (
								'Save Changes'
							) : (
								'Create User'
							)}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
