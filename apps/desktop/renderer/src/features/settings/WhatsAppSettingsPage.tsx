import { MessageSquare, ShieldCheck, Check } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import { WhatsAppSettingsSection } from './WhatsAppSettingsSection';
import { PoweredByTrovo } from '../../components/shared/PoweredByTrovo';

export function WhatsAppSettingsPage() {
	const { user, hasPermission } = useAuth();
	const canManageBusiness = Boolean(user?.isOwner || hasPermission('settings.business'));

	return (
		<div className="space-y-6 w-full">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
						WhatsApp Settings
					</h1>
					<p className="text-xs text-slate-500 mt-0.5">
						Configure Meta WhatsApp Cloud API credentials, utility notification templates, and automated delivery
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
				{/* Main WhatsApp Settings Section */}
				<div className="lg:col-span-2 space-y-6">
					<WhatsAppSettingsSection canManage={canManageBusiness} />
				</div>

				{/* WhatsApp Integration Sidebar */}
				<div className="space-y-6">
					{/* WhatsApp Overview Card */}
					<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
						<div className="flex items-center gap-2 pb-3 border-b border-slate-100">
							<div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
								<MessageSquare className="w-4 h-4" />
							</div>
							<div>
								<h3 className="text-xs font-bold text-slate-800">Cloud API Architecture</h3>
								<p className="text-[11px] text-slate-500">Direct Meta Integration</p>
							</div>
						</div>

						<div className="space-y-3 text-xs">
							<div className="flex justify-between py-1 border-b border-slate-100">
								<span className="text-slate-500">API Standard</span>
								<span className="font-mono font-semibold text-slate-800">Meta Graph API v25.0</span>
							</div>
							<div className="flex justify-between py-1 border-b border-slate-100">
								<span className="text-slate-500">Token Security</span>
								<span className="font-semibold text-emerald-700 flex items-center gap-1">
									<ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> AES-GCM Encrypted
								</span>
							</div>
							<div className="flex justify-between py-1 border-b border-slate-100">
								<span className="text-slate-500">Queue Processing</span>
								<span className="font-semibold text-slate-800">30s Auto Worker</span>
							</div>
							<div className="flex justify-between py-1">
								<span className="text-slate-500">Retry Policy</span>
								<span className="font-semibold text-slate-800">Exponential Backoff</span>
							</div>
						</div>
					</div>

					{/* Automation Rules Card */}
					<div className="bg-gradient-to-br from-emerald-50/70 to-slate-50 rounded-2xl border border-emerald-100 p-5 space-y-3">
						<h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
							<Check className="w-4 h-4 text-emerald-600" />
							<span>Production Triggers</span>
						</h4>

						<div className="space-y-2.5 text-[11px]">
							<div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100/70">
								<p className="font-bold text-slate-800">Invoice Finalized</p>
								<p className="text-slate-500 mt-0.5">
									Auto-sends approved invoice template with customer name, bill total, vehicle number, and public view link.
								</p>
							</div>

							<div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100/70">
								<p className="font-bold text-slate-800">Payment Completed</p>
								<p className="text-slate-500 mt-0.5">
									Auto-sends confirmation receipt when invoice balance reaches ₹0. Includes vehicle plate and amount paid.
								</p>
							</div>
						</div>
					</div>

					{/* Safety Note */}
					<div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-[11px] text-slate-600 space-y-1.5">
						<p className="font-bold text-slate-700">Durable Fault Isolation</p>
						<p className="text-slate-500 leading-relaxed">
							WhatsApp notifications run as background side effects. Even if Meta's Cloud API is temporarily unreachable, invoices and payments are always preserved without interruption.
						</p>
					</div>

					<div className="text-center pt-2">
						<PoweredByTrovo />
					</div>
				</div>
			</div>
		</div>
	);
}

export default WhatsAppSettingsPage;
