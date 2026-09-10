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
	ChevronDown,
	ChevronUp,
	Eye,
	EyeOff,
	RefreshCw,
	FileText,
	Globe,
	Tag,
	ExternalLink,
	Smartphone,
	Layers,
	Send,
	SendHorizontal,
	Info,
	X,
	Receipt,
	BellRing,
	Check,
} from 'lucide-react';
import {
	getWhatsAppConfig,
	updateWhatsAppConfig,
	testWhatsAppConnection,
	getWhatsAppTemplates,
	sendTestWhatsAppMessage,
	WhatsAppConfigDto,
	MetaWhatsAppTemplateDto,
} from '../../lib/api';

interface Props {
	canManage: boolean;
}

export function WhatsAppSettingsSection({ canManage }: Props) {
	const [config, setConfig] = useState<WhatsAppConfigDto | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [testing, setTesting] = useState(false);

	const [successMsg, setSuccessMsg] = useState<string | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: string | null } | null>(null);

	const [showToken, setShowToken] = useState(false);

	// Template Discovery State (Step 1)
	const [templates, setTemplates] = useState<MetaWhatsAppTemplateDto[] | null>(null);
	const [loadingTemplates, setLoadingTemplates] = useState(false);
	const [templateError, setTemplateError] = useState<string | null>(null);
	const [expandedTemplateIds, setExpandedTemplateIds] = useState<Record<string, boolean>>({});

	// Test Message Sending State (Step 2)
	const [selectedTestTemplateId, setSelectedTestTemplateId] = useState<string>('');
	const [testRecipientPhone, setTestRecipientPhone] = useState<string>('+91 75023 87733');
	const [testVariables, setTestVariables] = useState<string[]>(['John Doe', '500', 'TN01AB1234']);
	const [sendingTestMessage, setSendingTestMessage] = useState<boolean>(false);
	const [testMessageResult, setTestMessageResult] = useState<{
		success: boolean;
		message: string;
		messageId?: string | null;
		details?: string | null;
	} | null>(null);
	const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

	// Form State (Step 3 Production Configurations)
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

			// Auto-discover templates if credentials exist
			if (data.hasAccessToken && data.phoneNumberId) {
				handleFetchTemplates();
			}
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
				phoneNumberId: phoneNumberId.trim(),
				businessAccountId: businessAccountId.trim(),
				graphApiVersion: graphApiVersion.trim() || 'v25.0',
				accessToken: accessToken.trim() || undefined,
			});

			setTestResult({
				success: res.isSuccess,
				message: res.message,
				details: res.details,
			});

			const refreshed = await getWhatsAppConfig().catch(() => null);
			if (refreshed) {
				setConfig(refreshed);
			}
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

	function selectTemplateForTest(tpl: MetaWhatsAppTemplateDto) {
		setSelectedTestTemplateId(tpl.id);
		const bodyComp = tpl.components?.find((c) => c.type === 'BODY');
		const varCount = bodyComp?.variables?.length || 0;

		if (tpl.name.toLowerCase() === 'e6_car_spa_app') {
			setTestVariables(['John Doe', '500', 'TN01AB1234']);
		} else {
			const defaults: string[] = [];
			for (let i = 0; i < varCount; i++) {
				const ex = bodyComp?.examples && bodyComp.examples[i] ? bodyComp.examples[i] : '';
				defaults.push(ex);
			}
			setTestVariables(defaults);
		}
		setTestMessageResult(null);
	}

	async function handleFetchTemplates() {
		try {
			setLoadingTemplates(true);
			setTemplateError(null);
			const res = await getWhatsAppTemplates();
			if (res.isSuccess) {
				const list = res.templates || [];
				setTemplates(list);

				// If e6_car_spa_app is present and approved, select it for test by default
				const e6Template = list.find(
					(t) => t.name.toLowerCase() === 'e6_car_spa_app' && t.status.toUpperCase() === 'APPROVED'
				);
				if (e6Template) {
					selectTemplateForTest(e6Template);
				}
			} else {
				setTemplateError(res.message || 'Failed to retrieve message templates from Meta');
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to fetch WhatsApp templates';
			setTemplateError(msg);
		} finally {
			setLoadingTemplates(false);
		}
	}

	function handleTemplateSelectChange(templateId: string) {
		if (!templateId) {
			setSelectedTestTemplateId('');
			setTestVariables([]);
			setTestMessageResult(null);
			return;
		}

		const tpl = templates?.find((t) => t.id === templateId);
		if (tpl) {
			selectTemplateForTest(tpl);
		}
	}

	function handleVariableChange(index: number, val: string) {
		setTestVariables((prev) => {
			const copy = [...prev];
			copy[index] = val;
			return copy;
		});
	}

	async function handleSendTestMessage() {
		const targetTpl = templates?.find((t) => t.id === selectedTestTemplateId);
		if (!targetTpl || !canManage) return;

		try {
			setSendingTestMessage(true);
			setTestMessageResult(null);
			setShowConfirmModal(false);

			const res = await sendTestWhatsAppMessage({
				templateName: targetTpl.name,
				languageCode: targetTpl.language,
				recipientPhoneNumber: testRecipientPhone.trim(),
				parameters: testVariables,
			});

			setTestMessageResult({
				success: res.isSuccess,
				message: res.message,
				messageId: res.messageId,
				details: res.details,
			});
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to send test message';
			setTestMessageResult({
				success: false,
				message: msg,
			});
		} finally {
			setSendingTestMessage(false);
		}
	}

	function toggleTemplateExpand(id: string) {
		setExpandedTemplateIds((prev) => ({
			...prev,
			[id]: !prev[id],
		}));
	}

	function getStatusBadge(status: string) {
		const s = (status || '').toUpperCase();
		if (s === 'APPROVED') {
			return {
				label: 'Approved',
				className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
				dot: 'bg-emerald-500',
			};
		}
		if (s === 'PENDING') {
			return {
				label: 'Pending',
				className: 'bg-amber-50 text-amber-700 border-amber-200',
				dot: 'bg-amber-500',
			};
		}
		if (s === 'REJECTED') {
			return {
				label: 'Rejected',
				className: 'bg-rose-50 text-rose-700 border-rose-200',
				dot: 'bg-rose-500',
			};
		}
		if (s === 'PAUSED') {
			return {
				label: 'Paused',
				className: 'bg-orange-50 text-orange-700 border-orange-200',
				dot: 'bg-orange-500',
			};
		}
		return {
			label: status || 'Unknown',
			className: 'bg-slate-100 text-slate-600 border-slate-200',
			dot: 'bg-slate-400',
		};
	}

	if (loading) {
		return (
			<div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-center min-h-[200px]">
				<Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
			</div>
		);
	}

	const isConnected = isEnabled && config?.hasAccessToken && Boolean(phoneNumberId);

	const selectedTemplate = templates?.find((t) => t.id === selectedTestTemplateId);
	const approvedTemplates = templates?.filter((t) => t.status.toUpperCase() === 'APPROVED') || [];

	const selectedTemplateBodyComp = selectedTemplate?.components?.find((c) => c.type === 'BODY');
	const selectedTemplateHeaderComp = selectedTemplate?.components?.find((c) => c.type === 'HEADER');
	const selectedTemplateButtonsComp = selectedTemplate?.components?.find((c) => c.type === 'BUTTONS');

	const isUnsupportedTemplate = Boolean(
		selectedTemplate &&
			((selectedTemplateHeaderComp?.format && selectedTemplateHeaderComp.format.toUpperCase() !== 'TEXT') ||
				(selectedTemplateHeaderComp?.variables && selectedTemplateHeaderComp.variables.length > 0) ||
				selectedTemplateButtonsComp?.buttons?.some((b) => b.example && b.example.length > 0))
	);

	// Find discovered details for configured production templates
	const configuredInvoiceTpl =
		templates?.find((t) => t.name === invoiceTemplateName && t.language === invoiceTemplateLanguage) ||
		templates?.find((t) => t.name === invoiceTemplateName);

	const configuredPaymentTpl =
		templates?.find((t) => t.name === paymentCompletedTemplateName && t.language === paymentCompletedTemplateLanguage) ||
		templates?.find((t) => t.name === paymentCompletedTemplateName);

	function renderHealthBadge() {
		const status = config?.healthStatus || (isConnected ? 'Healthy' : 'NotConfigured');

		if (status === 'Healthy') {
			return (
				<div className="flex flex-col items-end gap-1">
					<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
						<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
						Connected
					</span>
					{config?.lastCheckedAtUtc && (
						<span className="text-[10px] text-slate-400">
							Last checked: {new Date(config.lastCheckedAtUtc).toLocaleTimeString()}
						</span>
					)}
				</div>
			);
		}

		if (status === 'AuthenticationFailed') {
			return (
				<div className="flex flex-col items-end gap-1">
					<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-rose-50 text-rose-700 border-rose-200">
						<span className="w-2 h-2 rounded-full bg-rose-500" />
						Authentication Failed
					</span>
					<span className="text-[10px] text-rose-600 font-medium">
						Please update the WhatsApp access token
					</span>
				</div>
			);
		}

		if (status === 'ConfigurationInvalid') {
			return (
				<div className="flex flex-col items-end gap-1">
					<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200">
						<span className="w-2 h-2 rounded-full bg-amber-500" />
						Configuration Invalid
					</span>
					<span className="text-[10px] text-amber-600 font-medium">
						Check Phone Number ID / Business Account ID
					</span>
				</div>
			);
		}

		if (status === 'TemporarilyUnavailable') {
			return (
				<div className="flex flex-col items-end gap-1">
					<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200">
						<span className="w-2 h-2 rounded-full bg-amber-400" />
						Temporarily Unavailable
					</span>
					<span className="text-[10px] text-slate-400">
						Meta/WhatsApp service could not be reached
					</span>
				</div>
			);
		}

		return (
			<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-slate-100 text-slate-600 border-slate-200">
				<span className="w-2 h-2 rounded-full bg-slate-400" />
				Not Configured
			</span>
		);
	}

	return (
		<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-8">
			{/* Main Section Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
				<div className="flex items-center gap-3">
					<div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
						<MessageSquare className="w-5 h-5" />
					</div>
					<div>
						<h3 className="text-sm font-bold text-slate-800">WhatsApp Business Integration</h3>
						<p className="text-xs text-slate-500">
							Automatic Cloud API notifications for finalized invoices and completed payments.
						</p>
					</div>
				</div>

				{/* Live Status Badge */}
				<div className="flex items-center gap-2">
					{renderHealthBadge()}
				</div>
			</div>

			{/* Status Feedback Messages */}
			{successMsg && (
				<div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
						<span>{successMsg}</span>
					</div>
					<button
						type="button"
						onClick={() => setSuccessMsg(null)}
						className="text-emerald-700 hover:text-emerald-900 p-0.5 rounded cursor-pointer"
					>
						<X className="w-3.5 h-3.5" />
					</button>
				</div>
			)}
			{errorMsg && (
				<div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
						<span>{errorMsg}</span>
					</div>
					<button
						type="button"
						onClick={() => setErrorMsg(null)}
						className="text-rose-700 hover:text-rose-900 p-0.5 rounded cursor-pointer"
					>
						<X className="w-3.5 h-3.5" />
					</button>
				</div>
			)}

			<form onSubmit={handleSave} className="space-y-8">
				{/* ============================================================== */}
				{/* 1. META CONNECTION                                             */}
				{/* ============================================================== */}
				<div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
						<div className="flex items-center gap-2.5">
							<div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
								<Activity className="w-4 h-4" />
							</div>
							<div>
								<h4 className="text-xs font-bold text-slate-800">1. Meta Connection</h4>
								<p className="text-[11px] text-slate-500">
									Configure Meta Graph API credentials for your WhatsApp Business Account.
								</p>
							</div>
						</div>

						{canManage && (
							<button
								type="button"
								onClick={handleTestConnection}
								disabled={testing || saving}
								className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 self-start sm:self-auto"
							>
								{testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
								{testing ? 'Testing...' : 'Test Connection'}
							</button>
						)}
					</div>

					{/* Connection Test Result */}
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
								<p className="text-[11px] opacity-85 font-mono break-all mt-1 pl-6">{testResult.details}</p>
							)}
						</div>
					)}

					{/* Master Enable Toggle */}
					<div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
						<div className="space-y-0.5">
							<label htmlFor="whatsapp-enabled-toggle" className="text-xs font-bold text-slate-800 cursor-pointer">
								Enable WhatsApp Business Integration
							</label>
							<p className="text-[11px] text-slate-500">
								When active, approved Meta template messages are dispatched automatically by background queue.
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

					{/* Credentials Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<label className="text-xs font-semibold text-slate-700">Phone Number ID</label>
							<input
								type="text"
								value={phoneNumberId}
								disabled={!canManage}
								onChange={(e) => setPhoneNumberId(e.target.value)}
								placeholder="Enter Meta Phone Number ID"
								className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-semibold text-slate-700">WhatsApp Business Account ID (WABA)</label>
							<input
								type="text"
								value={businessAccountId}
								disabled={!canManage}
								onChange={(e) => setBusinessAccountId(e.target.value)}
								placeholder="Enter WhatsApp Business Account ID"
								className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
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
								className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
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
									type={showToken ? 'text' : 'password'}
									value={accessToken}
									disabled={!canManage}
									onChange={(e) => setAccessToken(e.target.value)}
									placeholder={
										config?.hasAccessToken
											? '•••••••••••••••• (Configured — enter new token to update)'
											: 'Enter Meta Permanent Access Token'
									}
									className="w-full px-3.5 py-2 pr-10 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
								/>
								{accessToken ? (
									<button
										type="button"
										onClick={() => setShowToken(!showToken)}
										className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
									>
										{showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
									</button>
								) : (
									<Key className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
								)}
							</div>
							<p className="text-[10px] text-slate-500">
								{config?.hasAccessToken
									? 'Token is securely encrypted. Decrypted only inside backend service during dispatch.'
									: 'Enter your permanent System User Access Token from Meta Developer Portal.'}
							</p>
						</div>
					</div>
				</div>

				{/* ============================================================== */}
				{/* 2. AVAILABLE META TEMPLATES (STEP 1 DISCOVERY)                  */}
				{/* ============================================================== */}
				<div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
						<div>
							<h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
								<Layers className="w-4 h-4 text-emerald-600" />
								<span>2. Available Meta Templates (Live Discovery)</span>
							</h4>
							<p className="text-[11px] text-slate-500">
								Discovered message templates from your Meta WhatsApp Business Account. Only APPROVED templates can be used for production notifications.
							</p>
						</div>

						<button
							type="button"
							onClick={handleFetchTemplates}
							disabled={loadingTemplates}
							className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 self-start sm:self-auto"
						>
							<RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loadingTemplates ? 'animate-spin' : ''}`} />
							{loadingTemplates ? 'Fetching from Meta...' : 'Refresh Templates'}
						</button>
					</div>

					{/* Error state */}
					{templateError && (
						<div className="space-y-3">
							<div className="bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2">
								<AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
								<span>{templateError}</span>
							</div>

							{(templateError.toLowerCase().includes('expired') ||
								templateError.toLowerCase().includes('access token') ||
								templateError.includes('190')) && (
								<div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-2">
									<div className="flex items-center gap-2 font-bold text-amber-950">
										<Key className="w-4 h-4 text-amber-700 shrink-0" />
										<span>Meta Access Token Expired (Action Required)</span>
									</div>
									<p className="text-[11px] text-amber-800 leading-relaxed">
										Temporary tokens generated in the Meta Developer Portal expire automatically after <strong>24 hours</strong>.
										To restore template discovery and automated messaging:
									</p>
									<ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-900 pl-1">
										<li>
											Generate a new token in <strong>Meta for Developers</strong> (API Setup) or create a permanent{' '}
											<strong>System User Token</strong> in Meta Business Settings.
										</li>
										<li>
											Paste the new token into the <strong>Meta Access Token</strong> field in section 1 above.
										</li>
										<li>
											Click <strong>Save WhatsApp Settings</strong> at the bottom of the page.
										</li>
										<li>
											Click <strong>Refresh Templates</strong> to re-discover your approved templates.
										</li>
									</ol>
								</div>
							)}
						</div>
					)}

					{/* Initial state (before first load) */}
					{!templates && !loadingTemplates && !templateError && (
						<div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
							<FileText className="w-6 h-6 text-slate-400 mx-auto" />
							<p className="text-xs text-slate-600 font-medium">
								Click "Refresh Templates" to discover templates directly from your WhatsApp Business Account.
							</p>
						</div>
					)}

					{/* Loading state */}
					{loadingTemplates && !templates && (
						<div className="p-6 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center justify-center gap-2">
							<Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
							<p className="text-xs text-slate-500">Querying Meta Graph API templates...</p>
						</div>
					)}

					{/* Empty state */}
					{templates && templates.length === 0 && !loadingTemplates && (
						<div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
							<p className="text-xs font-bold text-slate-700">No Templates Found</p>
							<p className="text-[11px] text-slate-500">
								No WhatsApp templates were returned for this Business Account ID. Create templates in Meta WhatsApp Manager.
							</p>
						</div>
					)}

					{/* Templates list */}
					{templates && templates.length > 0 && (
						<div className="space-y-2.5">
							<div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
								<span>
									Found <strong className="text-slate-800">{templates.length}</strong> template{templates.length === 1 ? '' : 's'} ({approvedTemplates.length} approved)
								</span>
								<span className="text-[10px] text-slate-400">Click template name to inspect components & variables</span>
							</div>

							<div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
								{templates.map((tpl) => {
									const badge = getStatusBadge(tpl.status);
									const isExpanded = !!expandedTemplateIds[tpl.id];
									const isApproved = tpl.status.toUpperCase() === 'APPROVED';
									const bodyComp = tpl.components?.find((c) => c.type === 'BODY');
									const headerComp = tpl.components?.find((c) => c.type === 'HEADER');
									const footerComp = tpl.components?.find((c) => c.type === 'FOOTER');
									const buttonsComp = tpl.components?.find((c) => c.type === 'BUTTONS');

									return (
										<div
											key={tpl.id}
											className={`border rounded-xl bg-slate-50/60 overflow-hidden transition-all ${
												isApproved ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200/60 opacity-80'
											}`}
										>
											<div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
												<div className="flex items-start sm:items-center gap-2 flex-wrap">
													<button
														type="button"
														onClick={() => toggleTemplateExpand(tpl.id)}
														className="font-mono font-bold text-xs text-slate-800 hover:text-emerald-700 flex items-center gap-1.5 text-left cursor-pointer"
													>
														{tpl.name}
														{isExpanded ? (
															<ChevronUp className="w-3.5 h-3.5 text-slate-400" />
														) : (
															<ChevronDown className="w-3.5 h-3.5 text-slate-400" />
														)}
													</button>

													<span
														className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.className}`}
													>
														<span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
														{badge.label}
													</span>

													<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
														<Globe className="w-3 h-3 text-slate-400" />
														{tpl.language}
													</span>

													{tpl.category && (
														<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
															<Tag className="w-3 h-3 text-slate-400" />
															{tpl.category}
														</span>
													)}
												</div>

												{canManage && (
													<div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
														<button
															type="button"
															disabled={!isApproved}
															onClick={() => {
																if (!isApproved) {
																	setErrorMsg(`Template "${tpl.name}" is ${tpl.status}. Only APPROVED templates can be configured for production.`);
																	return;
																}
																setInvoiceTemplateName(tpl.name);
																setInvoiceTemplateLanguage(tpl.language);
																setSuccessMsg(`Selected approved template "${tpl.name}" (${tpl.language}) for Production Invoice Notification.`);
															}}
															className={`px-2 py-1 border rounded-lg text-[10px] font-semibold transition-colors ${
																isApproved
																	? 'bg-white hover:bg-emerald-50 hover:text-emerald-700 border-slate-200 text-slate-600 cursor-pointer'
																	: 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
															}`}
															title={isApproved ? 'Use for Production Invoice Notification' : 'Only approved templates can be used'}
														>
															Use for Invoice
														</button>
														<button
															type="button"
															disabled={!isApproved}
															onClick={() => {
																if (!isApproved) {
																	setErrorMsg(`Template "${tpl.name}" is ${tpl.status}. Only APPROVED templates can be configured for production.`);
																	return;
																}
																setPaymentCompletedTemplateName(tpl.name);
																setPaymentCompletedTemplateLanguage(tpl.language);
																setSuccessMsg(`Selected approved template "${tpl.name}" (${tpl.language}) for Production Payment Notification.`);
															}}
															className={`px-2 py-1 border rounded-lg text-[10px] font-semibold transition-colors ${
																isApproved
																	? 'bg-white hover:bg-emerald-50 hover:text-emerald-700 border-slate-200 text-slate-600 cursor-pointer'
																	: 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
															}`}
															title={isApproved ? 'Use for Production Payment Completed Notification' : 'Only approved templates can be used'}
														>
															Use for Payment
														</button>
													</div>
												)}
											</div>

											{/* Expanded Component Breakdown */}
											{isExpanded && (
												<div className="p-3.5 bg-white border-t border-slate-200/80 space-y-3 text-xs">
													{headerComp && (
														<div className="space-y-1">
															<div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
																<span>Header</span>
																<span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">
																	{headerComp.format || 'TEXT'}
																</span>
															</div>
															{headerComp.text && (
																<p className="text-slate-800 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100">
																	{headerComp.text}
																</p>
															)}
														</div>
													)}

													{bodyComp && (
														<div className="space-y-1">
															<div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
																<span>Body Text</span>
																{bodyComp.variables && bodyComp.variables.length > 0 && (
																	<span className="text-emerald-700 font-normal">
																		Variables: {bodyComp.variables.join(', ')}
																	</span>
																)}
															</div>
															<div className="text-slate-800 whitespace-pre-wrap bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono text-[11px] leading-relaxed">
																{bodyComp.text}
															</div>
															{bodyComp.examples && bodyComp.examples.length > 0 && (
																<div className="text-[10px] text-slate-500 pl-1">
																	<span className="font-semibold">Example Values:</span> {bodyComp.examples.join(', ')}
																</div>
															)}
														</div>
													)}

													{footerComp && footerComp.text && (
														<div className="space-y-1">
															<span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Footer</span>
															<p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
																{footerComp.text}
															</p>
														</div>
													)}

													{buttonsComp && buttonsComp.buttons && buttonsComp.buttons.length > 0 && (
														<div className="space-y-1.5">
															<span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Buttons</span>
															<div className="flex flex-wrap gap-2">
																{buttonsComp.buttons.map((btn, idx) => (
																	<div
																		key={idx}
																		className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[11px] text-slate-700"
																	>
																		{btn.type === 'URL' && <ExternalLink className="w-3 h-3 text-slate-400" />}
																		{btn.type === 'PHONE_NUMBER' && <Smartphone className="w-3 h-3 text-slate-400" />}
																		<span className="font-semibold">{btn.text || btn.type}</span>
																		{btn.url && <span className="text-slate-400 font-mono text-[10px]">({btn.url})</span>}
																		{btn.phoneNumber && (
																			<span className="text-slate-400 font-mono text-[10px]">({btn.phoneNumber})</span>
																		)}
																	</div>
																))}
															</div>
														</div>
													)}
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>

				{/* ============================================================== */}
				{/* 3. PRODUCTION INVOICE NOTIFICATION                             */}
				{/* ============================================================== */}
				<div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
						<div className="flex items-center gap-2.5">
							<div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
								<FileText className="w-4 h-4" />
							</div>
							<div>
								<h4 className="text-xs font-bold text-slate-800">3. Production Invoice Notification</h4>
								<p className="text-[11px] text-slate-500">
									These templates are used for automatic production notifications when an invoice is finalized.
								</p>
							</div>
						</div>

						<label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto">
							<input
								type="checkbox"
								checked={invoiceNotificationsEnabled}
								disabled={!canManage}
								onChange={(e) => setInvoiceNotificationsEnabled(e.target.checked)}
								className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
							/>
							<span className="text-xs font-semibold text-slate-700">Enabled</span>
						</label>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{/* Template Selection Dropdown (Only Approved Templates) */}
						<div className="space-y-1.5">
							<label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
								<span>Approved Invoice Template</span>
								{configuredInvoiceTpl && (
									<span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
										<Check className="w-3 h-3" /> Meta Approved
									</span>
								)}
							</label>

							<select
								value={invoiceTemplateName}
								disabled={!canManage || !invoiceNotificationsEnabled}
								onChange={(e) => {
									const name = e.target.value;
									setInvoiceTemplateName(name);
									const matched = approvedTemplates.find((t) => t.name === name);
									if (matched) {
										setInvoiceTemplateLanguage(matched.language);
									}
								}}
								className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800 bg-white"
							>
								{/* If template was saved earlier and not yet discovered, show it as configured */}
								{!approvedTemplates.some((t) => t.name === invoiceTemplateName) && invoiceTemplateName && (
									<option value={invoiceTemplateName}>
										{invoiceTemplateName} ({invoiceTemplateLanguage}) [Currently Configured]
									</option>
								)}

								{approvedTemplates.length === 0 ? (
									<option value="">
										{templates ? 'No approved templates found in WABA' : 'Click "Refresh Templates" above to discover templates'}
									</option>
								) : (
									<>
										<option value="">-- Select an Approved Meta Template --</option>
										{approvedTemplates.map((t) => (
											<option key={t.id} value={t.name}>
												{t.name} ({t.language}) — {t.category}
											</option>
										))}
									</>
								)}
							</select>
							<p className="text-[10px] text-slate-500">
								Only templates with APPROVED status in Meta Business Manager are selectable.
							</p>
						</div>

						{/* Template Language */}
						<div className="space-y-1.5">
							<label className="text-xs font-semibold text-slate-700">Template Language</label>
							<input
								type="text"
								value={invoiceTemplateLanguage}
								disabled={!canManage || !invoiceNotificationsEnabled}
								onChange={(e) => setInvoiceTemplateLanguage(e.target.value)}
								placeholder="en_US"
								className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
							/>
							<p className="text-[10px] text-slate-500">
								Language code must match the approved Meta template language (e.g. en_US).
							</p>
						</div>
					</div>

					{/* Active Template Preview Box */}
					{configuredInvoiceTpl && (
						<div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
							<div className="flex items-center justify-between text-[11px]">
								<span className="font-semibold text-slate-700">Template Preview ({configuredInvoiceTpl.name})</span>
								<span className="text-[10px] text-slate-500 font-mono">
									Variables: {configuredInvoiceTpl.components?.find((c) => c.type === 'BODY')?.variables?.length || 0}
								</span>
							</div>
							<p className="text-[11px] text-slate-600 font-mono bg-white p-2 rounded-lg border border-slate-200 whitespace-pre-wrap">
								{configuredInvoiceTpl.components?.find((c) => c.type === 'BODY')?.text || 'No body text'}
							</p>
							<p className="text-[10px] text-emerald-700 font-medium">
								✓ Template parameters are automatically resolved from customer, invoice number, amount, and public link.
							</p>
						</div>
					)}
				</div>

				{/* ============================================================== */}
				{/* 4. PRODUCTION PAYMENT NOTIFICATION                             */}
				{/* ============================================================== */}
				<div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
						<div className="flex items-center gap-2.5">
							<div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
								<Receipt className="w-4 h-4" />
							</div>
							<div>
								<h4 className="text-xs font-bold text-slate-800">4. Production Payment Notification</h4>
								<p className="text-[11px] text-slate-500">
									These templates are used for automatic production notifications when a payment transaction is completed.
								</p>
							</div>
						</div>

						<label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto">
							<input
								type="checkbox"
								checked={paymentCompletedNotificationsEnabled}
								disabled={!canManage}
								onChange={(e) => setPaymentCompletedNotificationsEnabled(e.target.checked)}
								className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
							/>
							<span className="text-xs font-semibold text-slate-700">Enabled</span>
						</label>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{/* Template Selection Dropdown (Only Approved Templates) */}
						<div className="space-y-1.5">
							<label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
								<span>Approved Payment Template</span>
								{configuredPaymentTpl && (
									<span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
										<Check className="w-3 h-3" /> Meta Approved
									</span>
								)}
							</label>

							<select
								value={paymentCompletedTemplateName}
								disabled={!canManage || !paymentCompletedNotificationsEnabled}
								onChange={(e) => {
									const name = e.target.value;
									setPaymentCompletedTemplateName(name);
									const matched = approvedTemplates.find((t) => t.name === name);
									if (matched) {
										setPaymentCompletedTemplateLanguage(matched.language);
									}
								}}
								className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800 bg-white"
							>
								{!approvedTemplates.some((t) => t.name === paymentCompletedTemplateName) &&
									paymentCompletedTemplateName && (
										<option value={paymentCompletedTemplateName}>
											{paymentCompletedTemplateName} ({paymentCompletedTemplateLanguage}) [Currently Configured]
										</option>
									)}

								{approvedTemplates.length === 0 ? (
									<option value="">
										{templates ? 'No approved templates found in WABA' : 'Click "Refresh Templates" above to discover templates'}
									</option>
								) : (
									<>
										<option value="">-- Select an Approved Meta Template --</option>
										{approvedTemplates.map((t) => (
											<option key={t.id} value={t.name}>
												{t.name} ({t.language}) — {t.category}
											</option>
										))}
									</>
								)}
							</select>
							<p className="text-[10px] text-slate-500">
								Only templates with APPROVED status in Meta Business Manager are selectable.
							</p>
						</div>

						{/* Template Language */}
						<div className="space-y-1.5">
							<label className="text-xs font-semibold text-slate-700">Template Language</label>
							<input
								type="text"
								value={paymentCompletedTemplateLanguage}
								disabled={!canManage || !paymentCompletedNotificationsEnabled}
								onChange={(e) => setPaymentCompletedTemplateLanguage(e.target.value)}
								placeholder="en_US"
								className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
							/>
							<p className="text-[10px] text-slate-500">
								Language code must match the approved Meta template language (e.g. en_US).
							</p>
						</div>
					</div>

					{/* Active Template Preview Box */}
					{configuredPaymentTpl && (
						<div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
							<div className="flex items-center justify-between text-[11px]">
								<span className="font-semibold text-slate-700">Template Preview ({configuredPaymentTpl.name})</span>
								<span className="text-[10px] text-slate-500 font-mono">
									Variables: {configuredPaymentTpl.components?.find((c) => c.type === 'BODY')?.variables?.length || 0}
								</span>
							</div>
							<p className="text-[11px] text-slate-600 font-mono bg-white p-2 rounded-lg border border-slate-200 whitespace-pre-wrap">
								{configuredPaymentTpl.components?.find((c) => c.type === 'BODY')?.text || 'No body text'}
							</p>
							<p className="text-[10px] text-emerald-700 font-medium">
								✓ Template parameters are automatically resolved from customer, payment amount, vehicle number, and balance.
							</p>
						</div>
					)}
				</div>

				{/* ============================================================== */}
				{/* 5. MANUAL TEST MESSAGE (STEP 2)                                 */}
				{/* ============================================================== */}
				<div className="p-5 bg-gradient-to-br from-slate-50 to-emerald-50/20 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
						<div className="flex items-center gap-2.5">
							<div className="p-2 bg-emerald-100/70 text-emerald-700 rounded-lg">
								<Send className="w-4 h-4" />
							</div>
							<div>
								<h4 className="text-xs font-bold text-slate-800">5. Manual Test Message</h4>
								<p className="text-[11px] text-slate-500">
									Send a live test template message through Meta Cloud API to verify template formatting & delivery. This test is completely independent of production notifications.
								</p>
							</div>
						</div>

						{!templates && (
							<button
								type="button"
								onClick={handleFetchTemplates}
								disabled={loadingTemplates}
								className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
							>
								<RefreshCw className={`w-3 h-3 ${loadingTemplates ? 'animate-spin' : ''}`} />
								Fetch Meta Templates First
							</button>
						)}
					</div>

					{/* Result Banner */}
					{testMessageResult && (
						<div
							className={`p-4 rounded-xl text-xs flex flex-col gap-1.5 border transition-all ${
								testMessageResult.success
									? 'bg-emerald-50 border-emerald-200 text-emerald-900'
									: 'bg-rose-50 border-rose-200 text-rose-900'
							}`}
						>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									{testMessageResult.success ? (
										<CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
									) : (
										<AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
									)}
									<span className="font-bold">
										{testMessageResult.success ? '✓ Message accepted by Meta.' : 'Test Message Failed'}
									</span>
								</div>
								{testMessageResult.messageId && (
									<span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-semibold border border-emerald-200">
										ID: {testMessageResult.messageId}
									</span>
								)}
							</div>

							{testMessageResult.success ? (
								<p className="text-[11px] text-emerald-700 pl-6">
									The message has been accepted by Meta for processing. Check the recipient's WhatsApp.
								</p>
							) : (
								<p className="text-[11px] text-rose-700 pl-6">{testMessageResult.message}</p>
							)}

							{testMessageResult.details && (
								<p className="text-[10px] font-mono text-slate-600 bg-white/70 p-2 rounded-lg border border-slate-200/60 mt-1 pl-3">
									{testMessageResult.details}
								</p>
							)}
						</div>
					)}

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{/* Template Selector */}
						<div className="space-y-1.5">
							<label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
								<span>Meta Template</span>
								{selectedTemplate && (
									<span className="text-[10px] text-slate-400 font-mono">
										Language: <strong className="text-slate-700">{selectedTemplate.language}</strong>
									</span>
								)}
							</label>

							<select
								value={selectedTestTemplateId}
								onChange={(e) => handleTemplateSelectChange(e.target.value)}
								disabled={!canManage || sendingTestMessage || approvedTemplates.length === 0}
								className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white font-mono text-slate-800"
							>
								{approvedTemplates.length === 0 ? (
									<option value="">
										{templates ? 'No approved WhatsApp templates available' : 'Click "Refresh Templates" above to discover templates'}
									</option>
								) : (
									<>
										<option value="">-- Select an Approved Template --</option>
										{approvedTemplates.map((t) => (
											<option key={t.id} value={t.id}>
												{t.name} ({t.language}) — {t.category}
											</option>
										))}
									</>
								)}
							</select>
							{approvedTemplates.length === 0 && templates && templates.length > 0 && (
								<p className="text-[10px] text-amber-600 font-medium">
									No approved WhatsApp templates are available for testing.
								</p>
							)}
						</div>

						{/* Recipient Phone Number */}
						<div className="space-y-1.5">
							<label className="text-xs font-semibold text-slate-700">Recipient WhatsApp Number</label>
							<input
								type="text"
								value={testRecipientPhone}
								onChange={(e) => setTestRecipientPhone(e.target.value)}
								disabled={!canManage || sendingTestMessage}
								placeholder="+91 75023 87733"
								className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800 bg-white"
							/>
							<p className="text-[10px] text-slate-500">
								This sends a real WhatsApp test message to the entered phone number.
							</p>
						</div>
					</div>

					{/* Unsupported Template Warning */}
					{isUnsupportedTemplate && (
						<div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
							<AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
							<span>This template contains unsupported parameters for the current test sender. Please select a text-only template.</span>
						</div>
					)}

					{/* Dynamic Body Variables Inputs */}
					{selectedTemplate && !isUnsupportedTemplate && selectedTemplateBodyComp && (
						<div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-xs font-bold text-slate-800">
									Template Variables ({testVariables.length})
								</span>
								<span className="text-[10px] text-slate-400 font-mono">
									{selectedTemplate.name} ({selectedTemplate.language})
								</span>
							</div>

							{testVariables.length === 0 ? (
								<p className="text-[11px] text-slate-500 italic">This template has no dynamic BODY variables.</p>
							) : (
								<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
									{testVariables.map((val, idx) => {
										const label =
											selectedTemplate.name.toLowerCase() === 'e6_car_spa_app'
												? idx === 0
													? 'Customer Name (Variable 1)'
													: idx === 1
													? 'Amount (Variable 2)'
													: 'Car Number (Variable 3)'
												: `Variable {{${idx + 1}}}`;

										const placeholder =
											selectedTemplate.name.toLowerCase() === 'e6_car_spa_app'
												? idx === 0
													? 'John Doe'
													: idx === 1
													? '500'
													: 'TN01AB1234'
												: `Enter value for {{${idx + 1}}}`;

										return (
											<div key={idx} className="space-y-1">
												<label className="text-[11px] font-semibold text-slate-600 block">{label}</label>
												<input
													type="text"
													value={val}
													disabled={!canManage || sendingTestMessage}
													onChange={(e) => handleVariableChange(idx, e.target.value)}
													placeholder={placeholder}
													className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
												/>
											</div>
										);
									})}
								</div>
							)}
						</div>
					)}

					{/* Trigger Button */}
					{canManage && (
						<div className="flex justify-end pt-1">
							<button
								type="button"
								onClick={() => setShowConfirmModal(true)}
								disabled={
									sendingTestMessage ||
									!selectedTemplate ||
									isUnsupportedTemplate ||
									!testRecipientPhone.trim()
								}
								className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
							>
								{sendingTestMessage ? (
									<>
										<Loader2 className="w-3.5 h-3.5 animate-spin" />
										<span>Sending to Meta...</span>
									</>
								) : (
									<>
										<SendHorizontal className="w-3.5 h-3.5" />
										<span>Send Test Message</span>
									</>
								)}
							</button>
						</div>
					)}
				</div>

				{/* Confirmation Modal */}
				{showConfirmModal && selectedTemplate && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
						<div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
							<div className="flex items-center justify-between pb-3 border-b border-slate-100">
								<div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
									<MessageSquare className="w-4 h-4 text-emerald-600" />
									<span>Confirm WhatsApp Test Send</span>
								</div>
								<button
									type="button"
									onClick={() => setShowConfirmModal(false)}
									className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
								>
									<X className="w-4 h-4" />
								</button>
							</div>

							<div className="space-y-3 text-xs">
								<p className="text-slate-600">
									Send a live WhatsApp template message to{' '}
									<strong className="text-slate-900 font-mono">{testRecipientPhone}</strong>?
								</p>

								<div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 font-mono text-[11px]">
									<div className="flex justify-between">
										<span className="text-slate-500 font-sans">Template:</span>
										<span className="font-bold text-slate-800">{selectedTemplate.name}</span>
									</div>
									<div className="flex justify-between">
										<span className="text-slate-500 font-sans">Language:</span>
										<span className="text-slate-700">{selectedTemplate.language}</span>
									</div>
									{testVariables.length > 0 && (
										<div className="pt-1.5 border-t border-slate-200/80">
											<span className="text-slate-500 font-sans block mb-1">Parameters:</span>
											<div className="space-y-0.5 pl-2 text-slate-700">
												{testVariables.map((val, i) => (
													<div key={i}>{`{{${i + 1}}}: "${val}"`}</div>
												))}
											</div>
										</div>
									)}
								</div>

								<div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
									<Info className="w-4 h-4 text-amber-600 shrink-0" />
									<span>This sends a real message through Meta Cloud API to the recipient's WhatsApp.</span>
								</div>
							</div>

							<div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
								<button
									type="button"
									onClick={() => setShowConfirmModal(false)}
									disabled={sendingTestMessage}
									className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={handleSendTestMessage}
									disabled={sendingTestMessage}
									className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
								>
									{sendingTestMessage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
									<span>{sendingTestMessage ? 'Sending...' : 'Confirm & Send'}</span>
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Global Save Button */}
				{canManage && (
					<div className="flex items-center justify-between pt-4 border-t border-slate-200">
						<div className="flex items-center gap-2 text-xs text-slate-500">
							<BellRing className="w-4 h-4 text-slate-400" />
							<span>Saving updates your production notification triggers and template selections.</span>
						</div>

						<button
							type="submit"
							disabled={saving || testing}
							className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
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
