import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import {
	getBusinessProfile,
	updateBusinessProfile,
	uploadBusinessLogo,
	removeBusinessLogo,
	resolveLogoUrl,
	setCachedBusinessProfile,
	BusinessProfileDto,
} from '../../lib/api';
import { InvoiceSeriesSection } from './InvoiceSeriesSection';
import { PoweredByTrovo } from '../../components/shared/PoweredByTrovo';
import { BUSINESS_PROFILE_QUERY_KEY } from './hooks/useBusinessProfile';
import { capitalizeSentence } from '../../utils/text';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

export default function SettingsPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const queryClient = useQueryClient();
	const { user, hasPermission } = useAuth();
	const canViewUsers = hasPermission('users.view');
	const canManageBusiness = Boolean(user?.isOwner || hasPermission('settings.business'));

	// Backward-compatibility redirect for legacy tab query parameters
	useEffect(() => {
		const tabParam = searchParams.get('tab');
		if (tabParam === 'whatsapp') {
			navigate('/settings/whatsapp', { replace: true });
		} else if (tabParam === 'system') {
			navigate('/settings/system', { replace: true });
		}
	}, [searchParams, navigate]);

	const [profile, setProfile] = useState<BusinessProfileDto | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [uploadingLogo, setUploadingLogo] = useState(false);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	// Form State
	const [businessName, setBusinessName] = useState('');
	const [addressLine1, setAddressLine1] = useState('');
	const [addressLine2, setAddressLine2] = useState('');
	const [city, setCity] = useState('');
	const [state, setState] = useState('');
	const [postalCode, setPostalCode] = useState('');
	const [phone, setPhone] = useState('');
	const [email, setEmail] = useState('');
	const [gstin, setGstin] = useState('');
	const [tagline, setTagline] = useState('');
	const [brandColor, setBrandColor] = useState('');
	const [termsAndConditions, setTermsAndConditions] = useState('');

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
			queryClient.setQueryData(BUSINESS_PROFILE_QUERY_KEY, data);
			setBusinessName(data.businessName || '');
			setAddressLine1(data.addressLine1 || '');
			setAddressLine2(data.addressLine2 || '');
			setCity(data.city || '');
			setState(data.state || '');
			setPostalCode(data.postalCode || '');
			setPhone(data.phone || '');
			setEmail(data.email || '');
			setGstin(data.gstin || '');
			setTagline(data.tagline || '');
			setBrandColor(data.brandColor || '');
			setTermsAndConditions(data.termsAndConditions || '');
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
		const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
		if (!cleanPhone) {
			setErrorMsg('Phone number is required.');
			return;
		}
		if (cleanPhone.length !== 10) {
			setErrorMsg('Phone number must be exactly 10 digits without country code.');
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

		const trimmedBrandColor = brandColor.trim();
		if (trimmedBrandColor && !/^#[0-9a-fA-F]{6}$/.test(trimmedBrandColor)) {
			setErrorMsg('Brand colour must be a colour code like #1E293B.');
			return;
		}

		try {
			setSaving(true);
			setErrorMsg(null);
			setSuccessMsg(null);

			const updated = await updateBusinessProfile({
				businessName: capitalizeSentence(businessName.trim()),
				addressLine1: capitalizeSentence(addressLine1.trim()),
				addressLine2: addressLine2.trim() ? capitalizeSentence(addressLine2.trim()) : null,
				city: capitalizeSentence(city.trim()),
				state: capitalizeSentence(state.trim()),
				postalCode: postalCode.trim(),
				phone: cleanPhone,
				email: email.trim(),
				gstin: trimmedGstin || null,
				logoPath: profile?.logoPath ?? null,
				// An empty string clears the value on the server; these appear on invoices and job cards.
				tagline: tagline.trim(),
				brandColor: trimmedBrandColor,
				termsAndConditions: termsAndConditions.trim(),
			});

			setProfile(updated);
			queryClient.setQueryData(BUSINESS_PROFILE_QUERY_KEY, updated);
			setCachedBusinessProfile(updated);
			setGstin(updated.gstin || '');
			setTagline(updated.tagline || '');
			setBrandColor(updated.brandColor || '');
			setTermsAndConditions(updated.termsAndConditions || '');
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
			queryClient.setQueryData(BUSINESS_PROFILE_QUERY_KEY, res.profile);
			setCachedBusinessProfile(res.profile);
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
			queryClient.setQueryData(BUSINESS_PROFILE_QUERY_KEY, updated);
			setCachedBusinessProfile(updated);
			setSuccessMsg('Logo removed successfully.');
			setTimeout(() => setSuccessMsg(null), 4000);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Failed to remove logo';
			setErrorMsg(msg);
		} finally {
			setUploadingLogo(false);
		}
	}

	const logoUrl = resolveLogoUrl(profile?.logoPath, profile?.updatedAt);

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
			</div>
		);
	}

	return (
		<div className="space-y-6 w-full">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
						Company Settings
					</h1>
					<p className="text-xs text-slate-500 mt-0.5">
						Configure company profile, tax invoice branding, and business identity
					</p>
				</div>
				{canManageBusiness && (
					<button
						type="submit"
						form="business-profile-form"
						disabled={saving || loading}
						className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
					>
						{saving ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<Save className="w-4 h-4" />
						)}
						{saving ? 'Saving...' : 'Save Settings'}
					</button>
				)}
			</div>

			{/* Notification Toasts */}
			{successMsg && (
				<div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
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

			{/* COMPANY SETTINGS CONTENT */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
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
									<div className="min-w-32 min-h-32 max-w-64 max-h-36 w-auto h-auto rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center p-2 relative overflow-hidden shrink-0 group">
										{profile?.logoPath ? (
											<img
												src={logoUrl}
												alt="Business Logo"
												className="max-h-28 max-w-56 w-auto h-auto object-contain block"
												onError={(e) => {
													(e.target as HTMLImageElement).style.display = 'none';
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
											onBlur={() => setBusinessName(capitalizeSentence(businessName))}
											placeholder="e.g. Sunrise Car Care"
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
											onBlur={() => setAddressLine1(capitalizeSentence(addressLine1))}
											placeholder="e.g. 12, Park Road"
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
											onBlur={() => setAddressLine2(capitalizeSentence(addressLine2))}
											placeholder="e.g. Near City Mall"
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
												onBlur={() => setCity(capitalizeSentence(city))}
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
												onBlur={() => setState(capitalizeSentence(state))}
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
												inputMode="numeric"
												maxLength={10}
												value={phone}
												disabled={!canManageBusiness}
												onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
												placeholder="e.g. 9876543210"
												className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
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
												placeholder="e.g. hello@yourcompany.com"
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

							{/* Document Appearance: what customers see on invoices and job cards */}
							<div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
								<div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
									<ImageIcon className="w-5 h-5 text-blue-600" />
									<h2 className="text-base font-bold text-slate-800">Invoice &amp; Job Card Appearance</h2>
								</div>

								<div className="space-y-4">
									<div>
										<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
											Tagline (Optional)
										</label>
										<input
											type="text"
											value={tagline}
											disabled={!canManageBusiness}
											maxLength={150}
											onChange={(e) => setTagline(e.target.value)}
											placeholder="e.g. Premium car care you can trust"
											className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
										/>
										<p className="text-[11px] text-slate-400 mt-1">Printed under your business name. Left off when blank.</p>
									</div>

									<div>
										<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
											Brand Colour (Optional)
										</label>
										<div className="flex items-center gap-3">
											<input
												type="color"
												aria-label="Pick brand colour"
												value={/^#[0-9a-fA-F]{6}$/.test(brandColor.trim()) ? brandColor.trim() : '#1E293B'}
												disabled={!canManageBusiness}
												onChange={(e) => setBrandColor(e.target.value.toUpperCase())}
												className="h-9 w-12 rounded-lg border border-slate-200 bg-white p-1 cursor-pointer disabled:cursor-not-allowed"
											/>
											<input
												type="text"
												value={brandColor}
												disabled={!canManageBusiness}
												maxLength={7}
												onChange={(e) => setBrandColor(e.target.value.toUpperCase())}
												placeholder="#1E293B"
												className="w-36 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
											/>
											{brandColor && canManageBusiness && (
												<button
													type="button"
													onClick={() => setBrandColor('')}
													className="text-xs text-slate-500 hover:text-slate-700 underline cursor-pointer"
												>
													Use default
												</button>
											)}
										</div>
										<p className="text-[11px] text-slate-400 mt-1">
											Used for headings and accents on invoices and job cards. A dark colour reads best.
										</p>
									</div>

									<div>
										<label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
											Terms &amp; Conditions (Optional)
										</label>
										<textarea
											value={termsAndConditions}
											disabled={!canManageBusiness}
											rows={4}
											maxLength={2000}
											onChange={(e) => setTermsAndConditions(e.target.value)}
											placeholder={'One line per term, e.g.\n1. Payment is due on delivery.\n2. Goods once sold are not returnable.'}
											className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
										/>
										<p className="text-[11px] text-slate-400 mt-1">
											Printed at the bottom of every invoice, one line per row. Nothing is printed when blank.
										</p>
									</div>
								</div>
							</div>

							{/* Invoice Configuration Section: separate GST / non-GST numbering (prefixes: Owner only) */}
							<InvoiceSeriesSection isOwner={Boolean(user?.isOwner || user?.role === 'Owner')} />

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
									<span className="text-slate-800 font-semibold">1.0.0 (Production)</span>
								</div>
								<div className="flex justify-between py-1.5 border-b border-slate-100">
									<span className="text-slate-500">Database</span>
									<span className="text-emerald-600 font-semibold">PostgreSQL Singleton</span>
								</div>
								<div className="flex justify-between py-1.5 border-b border-slate-100">
									<span className="text-slate-500">Platform</span>
									<span className="text-slate-800 font-semibold">Desktop (Windows)</span>
								</div>
								<div className="flex justify-between py-1.5">
									<span className="text-slate-500">Attribution</span>
									<span className="text-slate-700 font-medium text-right">Powered by Trovo Tech Solutions</span>
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
								Business profile details configured here serve as the single source of truth for print documents and customer invoices.
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
