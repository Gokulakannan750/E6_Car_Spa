import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	Users,
	Shield,
	ArrowRight,
	Save,
	Building2,
	Upload,
	Trash2,
	CheckCircle2,
	AlertCircle,
	FileText,
	Loader2,
	Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import {
	getBusinessProfile,
	updateBusinessProfile,
	uploadBusinessLogo,
	removeBusinessLogo,
	BusinessProfileDto,
} from '../../lib/api';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

export default function SettingsPage() {
	const navigate = useNavigate();
	const { user, hasPermission } = useAuth();
	const canViewUsers = hasPermission('users.view');
	const canManageBusiness = Boolean(user?.isOwner || hasPermission('settings.business'));

	const [profile, setProfile] = useState<BusinessProfileDto | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [uploadingLogo, setUploadingLogo] = useState(false);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	// Form State
	const [businessName, setBusinessName] = useState('E6 Car Spa');
	const [addressLine1, setAddressLine1] = useState('36, Geetha Nagar Main Road');
	const [addressLine2, setAddressLine2] = useState('Behind Sakthi Mahal, Perundurai Road');
	const [city, setCity] = useState('Erode');
	const [state, setState] = useState('Tamil Nadu');
	const [postalCode, setPostalCode] = useState('638011');
	const [phone, setPhone] = useState('+91 9578749449');
	const [email, setEmail] = useState('e6carspaerd@gmail.com');
	const [gstin, setGstin] = useState('');
	const [invoicePrefix, setInvoicePrefix] = useState('INV');

	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		loadProfile();
	}, []);

	async function loadProfile() {
		try {
			setLoading(true);
			setErrorMsg(null);
			const data = await getBusinessProfile();
			setProfile(data);
			setBusinessName(data.businessName || 'E6 Car Spa');
			setAddressLine1(data.addressLine1 || '36, Geetha Nagar Main Road');
			setAddressLine2(data.addressLine2 || 'Behind Sakthi Mahal, Perundurai Road');
			setCity(data.city || 'Erode');
			setState(data.state || 'Tamil Nadu');
			setPostalCode(data.postalCode || '638011');
			setPhone(data.phone || '+91 9578749449');
			setEmail(data.email || 'e6carspaerd@gmail.com');
			setGstin(data.gstin || '');
			setInvoicePrefix(data.invoicePrefix || 'INV');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to load business profile';
			setErrorMsg(msg);
		} finally {
			setLoading(false);
		}
	}

	async function handleSave(e: React.FormEvent) {
		e.preventDefault();
		if (!canManageBusiness) return;

		// Validation
		if (!businessName.trim()) {
			setErrorMsg('Business name is required.');
			return;
		}
		if (!addressLine1.trim()) {
			setErrorMsg('Address Line 1 is required.');
			return;
		}
		if (!city.trim() || !state.trim() || !postalCode.trim()) {
			setErrorMsg('City, State, and PIN code are required.');
			return;
		}
		if (!phone.trim()) {
			setErrorMsg('Phone number is required.');
			return;
		}
		if (!email.trim()) {
			setErrorMsg('Email address is required.');
			return;
		}

		const trimmedGstin = gstin.trim().toUpperCase();
		if (trimmedGstin && !GSTIN_REGEX.test(trimmedGstin)) {
			setErrorMsg('Invalid GSTIN format. Expected 15-character format (e.g. 33AAAAA0000A1Z5).');
			return;
		}

		try {
			setSaving(true);
			setErrorMsg(null);
			setSuccessMsg(null);

			const updated = await updateBusinessProfile({
				businessName: businessName.trim(),
				addressLine1: addressLine1.trim(),
				addressLine2: addressLine2.trim() || null,
				city: city.trim(),
				state: state.trim(),
				postalCode: postalCode.trim(),
				phone: phone.trim(),
				email: email.trim(),
				gstin: trimmedGstin || null,
				invoicePrefix: invoicePrefix.trim().toUpperCase() || 'INV',
				logoPath: profile?.logoPath ?? null,
			});

			setProfile(updated);
			setGstin(updated.gstin || '');
			setSuccessMsg('Business profile and invoice settings saved successfully.');
			setTimeout(() => setSuccessMsg(null), 4000);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to save settings';
			setErrorMsg(msg);
		} finally {
			setSaving(false);
		}
	}

	async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const files = e.target.files;
		if (!files || files.length === 0) return;
		const file = files[0];

		// Check file size (5MB max)
		if (file.size > 5 * 1024 * 1024) {
			setErrorMsg('Logo file size cannot exceed 5 MB.');
			return;
		}

		try {
			setUploadingLogo(true);
			setErrorMsg(null);
			setSuccessMsg(null);
			const res = await uploadBusinessLogo(file);
			setProfile(res.profile);
			setSuccessMsg('Logo updated successfully.');
			setTimeout(() => setSuccessMsg(null), 4000);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to upload logo';
			setErrorMsg(msg);
		} finally {
			setUploadingLogo(false);
			if (fileInputRef.current) fileInputRef.current.value = '';
		}
	}

	async function handleRemoveLogo() {
		if (!profile?.logoPath) return;
		if (!confirm('Are you sure you want to remove the business logo?')) return;

		try {
			setUploadingLogo(true);
			setErrorMsg(null);
			setSuccessMsg(null);
			const updated = await removeBusinessLogo();
			setProfile(updated);
			setSuccessMsg('Logo removed successfully.');
			setTimeout(() => setSuccessMsg(null), 4000);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to remove logo';
			setErrorMsg(msg);
		} finally {
			setUploadingLogo(false);
		}
	}

	const logoUrl = profile?.logoPath
		? profile.logoPath.startsWith('http')
			? profile.logoPath
			: profile.logoPath.startsWith('/uploads')
				? `http://localhost:5298${profile.logoPath}`
				: profile.logoPath
		: '/e6-logo.png';

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
					<p className="text-xs text-slate-500">
						Manage company profile, business details, and invoice configuration.
					</p>
				</div>
				{canManageBusiness && (
					<button
						type="submit"
						form="business-profile-form"
						disabled={saving}
						className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
					>
						{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
						{saving ? 'Saving...' : 'Save Settings'}
					</button>
				)}
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

					{/* Business Profile Form */}
					<form id="business-profile-form" onSubmit={handleSave} className="space-y-6">
						{/* Logo & Branding Section */}
						<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
							<div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
								<ImageIcon className="w-5 h-5 text-blue-600" />
								<h2 className="text-base font-bold text-slate-800">Business Logo</h2>
							</div>

							<div className="flex flex-col sm:flex-row items-center gap-6">
								{/* Logo Preview */}
								<div className="w-32 h-32 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center p-2 relative overflow-hidden shrink-0 group">
									{profile?.logoPath ? (
										<img
											src={logoUrl}
											alt="Business Logo"
											className="w-full h-full object-contain"
											onError={(e) => {
												(e.target as HTMLImageElement).src = '/e6-logo.png';
											}}
										/>
									) : (
										<div className="flex flex-col items-center justify-center text-slate-400 text-center p-2">
											<Building2 className="w-8 h-8 mb-1 opacity-50" />
											<span className="text-[10px] font-semibold uppercase">No Logo</span>
										</div>
									)}
									{uploadingLogo && (
										<div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
											<Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
										</div>
									)}
								</div>

								{/* Controls */}
								<div className="space-y-3 text-center sm:text-left">
									<div className="space-y-1">
										<p className="text-xs font-bold text-slate-700">Company Brand Logo</p>
										<p className="text-[11px] text-slate-500 leading-relaxed">
											Used on tax invoices and job card printouts. Recommended formats: PNG, JPEG, or WebP (max 5 MB).
										</p>
									</div>

									{canManageBusiness && (
										<div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
											<input
												ref={fileInputRef}
												type="file"
												accept="image/png,image/jpeg,image/webp"
												onChange={handleLogoUpload}
												className="hidden"
											/>
											<button
												type="button"
												disabled={uploadingLogo}
												onClick={() => fileInputRef.current?.click()}
												className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-2 rounded-xl transition-all cursor-pointer"
											>
												<Upload className="w-3.5 h-3.5" />
												Change Logo
											</button>
											{profile?.logoPath && (
												<button
													type="button"
													disabled={uploadingLogo}
													onClick={handleRemoveLogo}
													className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold px-3 py-2 rounded-xl transition-all cursor-pointer"
												>
													<Trash2 className="w-3.5 h-3.5" />
													Remove
												</button>
											)}
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Business Information Section */}
						<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
							<div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
								<Building2 className="w-5 h-5 text-blue-600" />
								<h2 className="text-base font-bold text-slate-800">Company Information</h2>
							</div>

							<div className="space-y-4">
								<div>
									<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
										Business Name <span className="text-rose-500">*</span>
									</label>
									<input
										type="text"
										value={businessName}
										disabled={!canManageBusiness}
										onChange={(e) => setBusinessName(e.target.value)}
										placeholder="e.g. E6 Car Spa"
										className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
									/>
								</div>

								<div>
									<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
										Address Line 1 <span className="text-rose-500">*</span>
									</label>
									<input
										type="text"
										value={addressLine1}
										disabled={!canManageBusiness}
										onChange={(e) => setAddressLine1(e.target.value)}
										placeholder="e.g. 36, Geetha Nagar Main Road"
										className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
									/>
								</div>

								<div>
									<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
										Address Line 2 (Optional)
									</label>
									<input
										type="text"
										value={addressLine2}
										disabled={!canManageBusiness}
										onChange={(e) => setAddressLine2(e.target.value)}
										placeholder="e.g. Behind Sakthi Mahal, Perundurai Road"
										className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
									/>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div>
										<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
											City <span className="text-rose-500">*</span>
										</label>
										<input
											type="text"
											value={city}
											disabled={!canManageBusiness}
											onChange={(e) => setCity(e.target.value)}
											placeholder="e.g. Erode"
											className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
										/>
									</div>
									<div>
										<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
											State <span className="text-rose-500">*</span>
										</label>
										<input
											type="text"
											value={state}
											disabled={!canManageBusiness}
											onChange={(e) => setState(e.target.value)}
											placeholder="e.g. Tamil Nadu"
											className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
										/>
									</div>
									<div>
										<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
											PIN Code <span className="text-rose-500">*</span>
										</label>
										<input
											type="text"
											value={postalCode}
											disabled={!canManageBusiness}
											onChange={(e) => setPostalCode(e.target.value)}
											placeholder="e.g. 638011"
											className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
										/>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
											Phone Number <span className="text-rose-500">*</span>
										</label>
										<input
											type="tel"
											value={phone}
											disabled={!canManageBusiness}
											onChange={(e) => setPhone(e.target.value)}
											placeholder="e.g. +91 9578749449"
											className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
										/>
									</div>
									<div>
										<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
											Email Address <span className="text-rose-500">*</span>
										</label>
										<input
											type="email"
											value={email}
											disabled={!canManageBusiness}
											onChange={(e) => setEmail(e.target.value)}
											placeholder="e.g. e6carspaerd@gmail.com"
											className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
										/>
									</div>
								</div>

								<div>
									<div className="flex items-center justify-between mb-1">
										<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
											GSTIN (Optional)
										</label>
										<span className="text-[10px] text-slate-400">15-digit Indian GSTIN</span>
									</div>
									<input
										type="text"
										value={gstin}
										disabled={!canManageBusiness}
										onChange={(e) => setGstin(e.target.value.toUpperCase())}
										placeholder="e.g. 33AAAAA0000A1Z5"
										maxLength={15}
										className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono uppercase disabled:bg-slate-100 disabled:text-slate-500"
									/>
									<p className="text-[11px] text-slate-400 mt-1">
										Leave blank if unregistered. When supplied, GSTIN will be formatted and included on tax invoices.
									</p>
								</div>
							</div>
						</div>

						{/* Invoice Configuration Section */}
						<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
							<div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
								<FileText className="w-5 h-5 text-blue-600" />
								<h2 className="text-base font-bold text-slate-800">Invoice Configuration</h2>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
										Invoice Prefix
									</label>
									<input
										type="text"
										value={invoicePrefix}
										disabled={!canManageBusiness}
										onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
										placeholder="e.g. INV"
										maxLength={10}
										className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono uppercase disabled:bg-slate-100 disabled:text-slate-500"
									/>
									<p className="text-[11px] text-slate-400 mt-1">
										Default: <span className="font-mono font-semibold">INV</span> (e.g. INV-2026-000001)
									</p>
								</div>
								<div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-600 flex flex-col justify-center">
									<p className="font-semibold text-slate-800 mb-0.5">GST Printing Rule</p>
									<p className="text-[11px] text-slate-500">
										GST breakdown on printouts is governed individually per invoice via the invoice GST toggle.
									</p>
								</div>
							</div>
						</div>

						{/* Bottom Save Action */}
						{canManageBusiness && (
							<div className="flex justify-end pt-2">
								<button
									type="submit"
									disabled={saving}
									className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all shadow-sm cursor-pointer"
								>
									{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
									{saving ? 'Saving Changes...' : 'Save Changes'}
								</button>
							</div>
						)}
					</form>
				</div>

				{/* Sidebar / Application Meta Card */}
				<div className="space-y-6">
					<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
						<h2 className="text-base font-bold text-slate-800 mb-4">Application Details</h2>
						<div className="space-y-3 text-xs">
							<div className="flex justify-between py-1.5 border-b border-slate-100">
								<span className="text-slate-500">Software</span>
								<span className="text-slate-800 font-semibold">E6 Car Spa Management</span>
							</div>
							<div className="flex justify-between py-1.5 border-b border-slate-100">
								<span className="text-slate-500">Version</span>
								<span className="text-slate-800 font-semibold">1.0.0 (Step 15A)</span>
							</div>
							<div className="flex justify-between py-1.5 border-b border-slate-100">
								<span className="text-slate-500">Build Timestamp</span>
								<span className="text-slate-800 font-semibold">2026.08.24</span>
							</div>
							<div className="flex justify-between py-1.5 border-b border-slate-100">
								<span className="text-slate-500">Architecture</span>
								<span className="text-emerald-600 font-semibold">PostgreSQL Singleton</span>
							</div>
							<div className="flex justify-between py-1.5">
								<span className="text-slate-500">Platform</span>
								<span className="text-slate-800 font-semibold">Desktop (Windows)</span>
							</div>
						</div>
					</div>

					{/* Print Templates Notice */}
					<div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-blue-900 text-xs space-y-2">
						<div className="flex items-center gap-2 font-bold text-blue-950">
							<FileText className="w-4 h-4 text-blue-600" />
							Print Foundation Active
						</div>
						<p className="text-blue-800/80 leading-relaxed">
							Business profile details configured here will serve as the single source of truth for print documents in Step 15B.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
