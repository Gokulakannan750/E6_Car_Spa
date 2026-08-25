import { useState, useEffect } from 'react';
import {
	MessageSquare,
	CheckCircle2,
	AlertCircle,
	Loader2,
	Save,
	Activity,
	Key,
	ShieldCheck,
	Settings2,
	ChevronDown,
	ChevronUp,
} from 'lucide-react';
import {
	getWhatsAppConfig,
	updateWhatsAppConfig,
	testWhatsAppConnection,
	WhatsAppConfigDto,
} from '../../lib/api';

interface Props {
	canManage: boolean;
}

export function WhatsAppSettingsSection({ canManage }: Props) {
	const [config, setConfig] = useState<WhatsAppConfigDto | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [testing, setTesting] = useState(false);
	const [showTemplates, setShowTemplates] = useState(false);

	const [successMsg, setSuccessMsg] = useState<string | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: string | null } | null>(null);

	// Form State
	const [isEnabled, setIsEnabled] = useState(false);
	const [phoneNumberId, setPhoneNumberId] = useState('');
	const [businessAccountId, setBusinessAccountId] = useState('');
	const [graphApiVersion, setGraphApiVersion] = useState('v25.0');
	const [accessToken, setAccessToken] = useState('');
	const [invoiceNotificationsEnabled, setInvoiceNotificationsEnabled] = useState(true);
	const [paymentCompletedNotificationsEnabled, setPaymentCompletedNotificationsEnabled] = useState(true);
	const [invoiceTemplateName, setInvoiceTemplateName] = useState('e6_carspa_invoice_generated');
	const [invoiceTemplateLanguage, setInvoiceTemplateLanguage] = useState('en_US');
	const [paymentCompletedTemplateName, setPaymentCompletedTemplateName] = useState('e6_carspa_payment_completed');
	const [paymentCompletedTemplateLanguage, setPaymentCompletedTemplateLanguage] = useState('en_US');

	useEffect(() => {
		loadConfig();
	}, []);

	async function loadConfig() {
		try {
			setLoading(true);
			setErrorMsg(null);
			const data = await getWhatsAppConfig();
			setConfig(data);
			setIsEnabled(data.isEnabled);
			setPhoneNumberId(data.phoneNumberId || '');
			setBusinessAccountId(data.businessAccountId || '');
			setGraphApiVersion(data.graphApiVersion || 'v25.0');
			setInvoiceNotificationsEnabled(data.invoiceNotificationsEnabled);
			setPaymentCompletedNotificationsEnabled(data.paymentCompletedNotificationsEnabled);
			setInvoiceTemplateName(data.invoiceTemplateName || 'e6_carspa_invoice_generated');
			setInvoiceTemplateLanguage(data.invoiceTemplateLanguage || 'en_US');
			setPaymentCompletedTemplateName(data.paymentCompletedTemplateName || 'e6_carspa_payment_completed');
			setPaymentCompletedTemplateLanguage(data.paymentCompletedTemplateLanguage || 'en_US');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to load WhatsApp configuration';
			setErrorMsg(msg);
		} finally {
			setLoading(false);
		}
	}

	async function handleSave(e: React.FormEvent) {
		e.preventDefault();
		if (!canManage) return;

		try {
			setSaving(true);
			setErrorMsg(null);
			setSuccessMsg(null);
			setTestResult(null);

			const payload: Parameters<typeof updateWhatsAppConfig>[0] = {
				isEnabled,
				phoneNumberId: phoneNumberId.trim(),
				businessAccountId: businessAccountId.trim(),
				graphApiVersion: graphApiVersion.trim(),
				invoiceNotificationsEnabled,
				paymentCompletedNotificationsEnabled,
				invoiceTemplateName: invoiceTemplateName.trim(),
				invoiceTemplateLanguage: invoiceTemplateLanguage.trim(),
				paymentCompletedTemplateName: paymentCompletedTemplateName.trim(),
				paymentCompletedTemplateLanguage: paymentCompletedTemplateLanguage.trim(),
			};

			if (accessToken.trim()) {
				payload.accessToken = accessToken.trim();
			}

			const updated = await updateWhatsAppConfig(payload);
			setConfig(updated);
			setAccessToken('');
			setSuccessMsg('WhatsApp settings saved successfully.');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to save WhatsApp settings';
			setErrorMsg(msg);
		} finally {
			setSaving(false);
		}
	}

	async function handleTestConnection() {
		try {
			setTesting(true);
			setTestResult(null);
			setErrorMsg(null);

			const res = await testWhatsAppConnection({
				phoneNumberId: phoneNumberId.trim() || undefined,
				businessAccountId: businessAccountId.trim() || undefined,
				graphApiVersion: graphApiVersion.trim() || undefined,
				accessToken: accessToken.trim() || undefined,
			});

			setTestResult({
				success: res.isSuccess,
				message: res.message,
				details: res.details,
			});
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Connection test request failed';
			setTestResult({
				success: false,
				message: msg,
			});
		} finally {
			setTesting(false);
		}
	}

	if (loading) {
		return (
			<div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-center min-h-[200px]">
				<Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
			</div>
		);
	}

	const isConnected = isEnabled && config?.hasAccessToken && Boolean(phoneNumberId);

	return (
		<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
			{/* Section Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
						<MessageSquare className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-base font-bold text-slate-800">WhatsApp Business Integration</h2>
						<p className="text-xs text-slate-500">
							Automatic Cloud API notifications for finalized invoices and completed payments.
						</p>
					</div>
				</div>

				{/* Status Badge */}
				<div className="flex items-center gap-2">
					<span
						className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
							isConnected
								? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
								: isEnabled
								? 'bg-amber-50 text-amber-700 border border-amber-200'
								: 'bg-slate-100 text-slate-600 border border-slate-200'
						}`}
					>
						<span
							className={`w-2 h-2 rounded-full ${
								isConnected ? 'bg-emerald-500 animate-pulse' : isEnabled ? 'bg-amber-500' : 'bg-slate-400'
							}`}
						/>
						{isConnected ? 'Connected' : isEnabled ? 'Setup Required' : 'Disabled'}
					</span>
				</div>
			</div>

			{/* Alerts */}
			{successMsg && (
				<div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
					<CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
					{successMsg}
				</div>
			)}
			{errorMsg && (
				<div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
					<AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
					{errorMsg}
				</div>
			)}
			{testResult && (
				<div
					className={`px-4 py-3 rounded-xl text-xs font-medium flex flex-col gap-1 border ${
						testResult.success
							? 'bg-emerald-50 border-emerald-200 text-emerald-800'
							: 'bg-rose-50 border-rose-200 text-rose-800'
					}`}
				>
					<div className="flex items-center gap-2">
						{testResult.success ? (
							<CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
						) : (
							<AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
						)}
						<span className="font-bold">{testResult.message}</span>
					</div>
					{testResult.details && (
						<p className="text-[11px] opacity-85 font-mono break-all mt-1 pl-6">
							{testResult.details}
						</p>
					)}
				</div>
			)}

			<form onSubmit={handleSave} className="space-y-6">
				{/* Enable Toggle Switch */}
				<div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80">
					<div className="space-y-0.5">
						<label htmlFor="whatsapp-enabled-toggle" className="text-xs font-bold text-slate-800 cursor-pointer">
							Enable Automatic WhatsApp Notifications
						</label>
						<p className="text-[11px] text-slate-500">
							When active, Meta WhatsApp Cloud API messages are dispatched automatically on business events.
						</p>
					</div>
					<label className="relative inline-flex items-center cursor-pointer">
						<input
							id="whatsapp-enabled-toggle"
							type="checkbox"
							checked={isEnabled}
							disabled={!canManage}
							onChange={(e) => setIsEnabled(e.target.checked)}
							className="sr-only peer"
						/>
						<div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
					</label>
				</div>

				{/* Meta Credentials Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-1.5">
						<label className="text-xs font-semibold text-slate-700">Phone Number ID</label>
						<input
							type="text"
							value={phoneNumberId}
							disabled={!canManage}
							onChange={(e) => setPhoneNumberId(e.target.value)}
							placeholder="e.g. 1263387163523264"
							className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-slate-800"
						/>
					</div>

					<div className="space-y-1.5">
						<label className="text-xs font-semibold text-slate-700">WhatsApp Business Account ID</label>
						<input
							type="text"
							value={businessAccountId}
							disabled={!canManage}
							onChange={(e) => setBusinessAccountId(e.target.value)}
							placeholder="e.g. 1046927407924057"
							className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-slate-800"
						/>
					</div>

					<div className="space-y-1.5">
						<label className="text-xs font-semibold text-slate-700">Graph API Version</label>
						<input
							type="text"
							value={graphApiVersion}
							disabled={!canManage}
							onChange={(e) => setGraphApiVersion(e.target.value)}
							placeholder="v25.0"
							className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-slate-800"
						/>
					</div>

					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<label className="text-xs font-semibold text-slate-700">Meta Access Token</label>
							{config?.hasAccessToken && (
								<span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
									<ShieldCheck className="w-3 h-3" />
									Encrypted at rest
								</span>
							)}
						</div>
						<div className="relative">
							<input
								type="password"
								value={accessToken}
								disabled={!canManage}
								onChange={(e) => setAccessToken(e.target.value)}
								placeholder={
									config?.hasAccessToken
										? '•••••••••••••••• (Configured — leave blank to keep)'
										: 'Enter Meta System User Token'
								}
								className="w-full px-3.5 py-2 pr-10 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-slate-800"
							/>
							<Key className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
						</div>
					</div>
				</div>

				{/* Event Notification Preferences */}
				<div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
					<p className="text-xs font-bold text-slate-800">Notification Triggers</p>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<label className="flex items-start gap-2.5 cursor-pointer">
							<input
								type="checkbox"
								checked={invoiceNotificationsEnabled}
								disabled={!canManage}
								onChange={(e) => setInvoiceNotificationsEnabled(e.target.checked)}
								className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 mt-0.5"
							/>
							<div className="space-y-0.5">
								<span className="text-xs font-semibold text-slate-700 block">Invoice Finalized</span>
								<span className="text-[11px] text-slate-500 block">
									Sends public invoice link when an invoice is generated/finalized.
								</span>
							</div>
						</label>

						<label className="flex items-start gap-2.5 cursor-pointer">
							<input
								type="checkbox"
								checked={paymentCompletedNotificationsEnabled}
								disabled={!canManage}
								onChange={(e) => setPaymentCompletedNotificationsEnabled(e.target.checked)}
								className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 mt-0.5"
							/>
							<div className="space-y-0.5">
								<span className="text-xs font-semibold text-slate-700 block">Payment Completed</span>
								<span className="text-[11px] text-slate-500 block">
									Sends thank-you confirmation when an invoice balance becomes ₹0.
								</span>
							</div>
						</label>
					</div>
				</div>

				{/* Template Customization (Collapsible) */}
				<div className="border border-slate-200 rounded-xl overflow-hidden">
					<button
						type="button"
						onClick={() => setShowTemplates(!showTemplates)}
						className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left text-xs font-bold text-slate-700 transition-colors"
					>
						<div className="flex items-center gap-2">
							<Settings2 className="w-4 h-4 text-slate-500" />
							<span>Meta Template Configuration (Advanced)</span>
						</div>
						{showTemplates ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
					</button>

					{showTemplates && (
						<div className="p-4 space-y-4 bg-white border-t border-slate-200">
							<p className="text-[11px] text-slate-500">
								Configure Meta-approved template names and language codes for your WhatsApp Business account.
							</p>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<label className="text-xs font-semibold text-slate-700">Invoice Template Name</label>
									<input
										type="text"
										value={invoiceTemplateName}
										disabled={!canManage}
										onChange={(e) => setInvoiceTemplateName(e.target.value)}
										className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
									/>
								</div>
								<div className="space-y-1.5">
									<label className="text-xs font-semibold text-slate-700">Invoice Template Language</label>
									<input
										type="text"
										value={invoiceTemplateLanguage}
										disabled={!canManage}
										onChange={(e) => setInvoiceTemplateLanguage(e.target.value)}
										className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
									/>
								</div>
								<div className="space-y-1.5">
									<label className="text-xs font-semibold text-slate-700">Payment Completed Template Name</label>
									<input
										type="text"
										value={paymentCompletedTemplateName}
										disabled={!canManage}
										onChange={(e) => setPaymentCompletedTemplateName(e.target.value)}
										className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
									/>
								</div>
								<div className="space-y-1.5">
									<label className="text-xs font-semibold text-slate-700">Payment Completed Template Language</label>
									<input
										type="text"
										value={paymentCompletedTemplateLanguage}
										disabled={!canManage}
										onChange={(e) => setPaymentCompletedTemplateLanguage(e.target.value)}
										className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
									/>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Action Buttons */}
				{canManage && (
					<div className="flex items-center justify-between pt-2">
						<button
							type="button"
							onClick={handleTestConnection}
							disabled={testing || saving}
							className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
						>
							{testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
							{testing ? 'Testing Connection...' : 'Test Connection'}
						</button>

						<button
							type="submit"
							disabled={saving || testing}
							className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
						>
							{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
							{saving ? 'Saving...' : 'Save WhatsApp Settings'}
						</button>
					</div>
				)}
			</form>
		</div>
	);
}
