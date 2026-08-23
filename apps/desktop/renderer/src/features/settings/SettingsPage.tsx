import { useNavigate } from 'react-router-dom';
import { Users, Shield, ArrowRight, Save } from 'lucide-react';
import { useAuth } from '../auth/auth-context';

export default function SettingsPage() {
	const navigate = useNavigate();
	const { hasPermission } = useAuth();
	const canViewUsers = hasPermission('users.view');

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
				<button className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs uppercase tracking-wider px-4 py-2 rounded-xl transition-all shadow-sm">
					<Save className="w-4 h-4" />
					Save Settings
				</button>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-2 space-y-6">
					{/* Users & Permissions Quick Card */}
					{canViewUsers && (
						<div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-md flex items-center justify-between">
							<div className="space-y-1 max-w-md">
								<div className="flex items-center gap-2 font-bold text-base">
									<Shield className="w-5 h-5 text-blue-400" />
									Users & Permissions Management
								</div>
								<p className="text-xs text-blue-200/90 leading-relaxed">
									Create staff accounts, assign granular module permissions, and manage active logins.
								</p>
							</div>
							<button
								onClick={() => navigate('/settings/users')}
								className="flex items-center gap-2 bg-white text-blue-950 font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-blue-50 transition-all shadow-sm cursor-pointer shrink-0"
							>
								<Users className="w-4 h-4 text-blue-600" />
								Manage Users
								<ArrowRight className="w-3.5 h-3.5" />
							</button>
						</div>
					)}

					{/* Company Info */}
					<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
						<h2 className="text-lg font-bold text-slate-800 mb-4">Company Information</h2>
						<div className="space-y-4">
							<div>
								<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Company Name</label>
								<input type="text" defaultValue="E6 Car Spa Management" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Phone</label>
									<input type="tel" defaultValue="+91 98765 43210" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
								</div>
								<div>
									<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Email</label>
									<input type="email" defaultValue="info@e6carspa.com" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
								</div>
							</div>
							<div>
								<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Address</label>
								<textarea rows={3} defaultValue="123 Main Street, Chennai - 600001" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none" />
							</div>
						</div>
					</div>

					{/* Invoice Settings */}
					<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
						<h2 className="text-lg font-bold text-slate-800 mb-4">Invoice Settings</h2>
						<div className="space-y-4">
							<div className="grid grid-cols-3 gap-4">
								<div>
									<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Currency</label>
									<select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
										<option value="INR">INR (₹)</option>
										<option value="USD">USD ($)</option>
									</select>
								</div>
								<div>
									<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Tax Rate (%)</label>
									<input type="number" defaultValue="18" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
								</div>
								<div>
									<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Invoice Prefix</label>
									<input type="text" defaultValue="INV" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className="space-y-6">
					{/* Application Info */}
					<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
						<h2 className="text-lg font-bold text-slate-800 mb-4">Application</h2>
						<div className="space-y-3 text-sm">
							<div className="flex justify-between">
								<span className="text-slate-500">Version</span>
								<span className="text-slate-800 font-semibold">1.0.0</span>
							</div>
							<div className="flex justify-between">
								<span className="text-slate-500">Build</span>
								<span className="text-slate-800 font-semibold">2026.08.23</span>
							</div>
							<div className="flex justify-between">
								<span className="text-slate-500">Security Foundation</span>
								<span className="text-emerald-600 font-semibold">Active</span>
							</div>
							<div className="flex justify-between">
								<span className="text-slate-500">Platform</span>
								<span className="text-slate-800 font-semibold">Desktop (Windows)</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
