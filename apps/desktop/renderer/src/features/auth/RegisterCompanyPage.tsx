import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerCompany, rememberCompanyCode, ApiError } from '../../lib/api';
import { capitalizeSentence } from '../../utils/text';
import { Building2, KeyRound, ShieldCheck, UserCheck, Lock, User, CheckCircle2 } from 'lucide-react';
import { BrandMark } from '../../components/shared/BrandMark';
import { PRODUCT, productPaletteStyle } from '../../config/product';

const inputClass =
	'w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all';
const labelClass = 'block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5';

/**
 * First registration of a company on Trovo's platform. Trovo gives the customer a company code and a one-time
 * registration code; with both, the customer creates the company's Owner account.
 */
export default function RegisterCompanyPage() {
	const [companyCode, setCompanyCode] = useState('');
	const [registrationCode, setRegistrationCode] = useState('');
	const [fullName, setFullName] = useState('');
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [error, setError] = useState('');
	const [successMsg, setSuccessMsg] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const navigate = useNavigate();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

		if (!companyCode.trim()) return setError('Company code is required.');
		if (!registrationCode.trim()) return setError('Registration code is required.');
		if (!fullName.trim()) return setError('Full name is required.');
		if (!username.trim()) return setError('Username is required.');
		if (password.length < 8) return setError('Password must be at least 8 characters long.');
		if (password !== confirmPassword) return setError('Passwords do not match.');
		if (password.trim().toLowerCase() === username.trim().toLowerCase()) {
			return setError('Password cannot be the same as the username.');
		}

		setIsSubmitting(true);
		try {
			const owner = await registerCompany({
				companyCode: companyCode.trim().toUpperCase(),
				registrationCode: registrationCode.trim(),
				fullName: capitalizeSentence(fullName.trim()),
				username: username.trim().toLowerCase(),
				password,
				confirmPassword,
			});
			rememberCompanyCode(owner.companyCode);
			setSuccessMsg(`Company ${owner.companyCode} is registered. Redirecting to sign in...`);
			setTimeout(() => navigate('/login', { replace: true }), 1500);
		} catch (err: unknown) {
			if (err instanceof ApiError || err instanceof Error) {
				setError(err.message || 'Registration failed.');
			} else {
				setError('An unexpected error occurred.');
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-side-950 via-black to-side-950 flex items-center justify-center p-6" style={productPaletteStyle()}>
			<div className="w-full max-w-md">
				<div className="text-center mb-8">
					{PRODUCT.logo ? (
						<img src={PRODUCT.logo} alt="" className="mx-auto mb-4 h-16 w-16 object-contain" />
					) : (
						<div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-side-600 to-side-900 shadow-lg shadow-side-900/40 text-white font-black text-2xl mb-4">
							<BrandMark name={PRODUCT.name} iconClassName="h-8 w-8" />
						</div>
					)}
					<h1 className="text-2xl font-extrabold text-white tracking-tight">
						WELCOME TO {PRODUCT.name.toUpperCase()}
					</h1>
					<p className="text-sm text-blue-200/80 mt-1 font-medium">Register Your Company</p>
				</div>

				<div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
					{error && (
						<div role="alert" className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
							{error}
						</div>
					)}

					{successMsg && (
						<div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl flex items-center gap-2">
							<CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
							<span>{successMsg}</span>
						</div>
					)}

					<div className="mb-6 p-3 bg-blue-50/80 border border-blue-100 rounded-xl flex items-start gap-2.5">
						<ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
						<div className="text-xs text-blue-900 leading-relaxed">
							Enter the <strong>company code</strong> and <strong>registration code</strong> you received from Trovo,
							then create the <strong>Owner</strong> account. The registration code works only once.
						</div>
					</div>

					<form onSubmit={handleSubmit} className="space-y-4" noValidate>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label htmlFor="companyCode" className={labelClass}>Company Code</label>
								<div className="relative">
									<Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
									<input
										id="companyCode"
										type="text"
										value={companyCode}
										onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
										placeholder="e.g. 0002"
										autoComplete="off"
										className={inputClass}
									/>
								</div>
							</div>
							<div>
								<label htmlFor="registrationCode" className={labelClass}>Registration Code</label>
								<div className="relative">
									<KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
									<input
										id="registrationCode"
										type="text"
										value={registrationCode}
										onChange={(e) => setRegistrationCode(e.target.value.toUpperCase())}
										placeholder="XXXX-XXXX-XXXX"
										autoComplete="off"
										spellCheck={false}
										className={inputClass}
									/>
								</div>
							</div>
						</div>

						<div>
							<label htmlFor="fullName" className={labelClass}>Owner Full Name</label>
							<div className="relative">
								<User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
								<input
									id="fullName"
									type="text"
									value={fullName}
									onChange={(e) => setFullName(e.target.value)}
									onBlur={() => setFullName(capitalizeSentence(fullName))}
									className={inputClass}
								/>
							</div>
						</div>

						<div>
							<label htmlFor="username" className={labelClass}>Username</label>
							<div className="relative">
								<UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
								<input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
							</div>
						</div>

						<div>
							<label htmlFor="password" className={labelClass}>Password</label>
							<div className="relative">
								<Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
								<input
									id="password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Minimum 8 characters"
									autoComplete="new-password"
									className={inputClass}
								/>
							</div>
						</div>

						<div>
							<label htmlFor="confirmPassword" className={labelClass}>Confirm Password</label>
							<div className="relative">
								<Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
								<input
									id="confirmPassword"
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									autoComplete="new-password"
									className={inputClass}
								/>
							</div>
						</div>

						<button
							type="submit"
							disabled={isSubmitting || !!successMsg}
							className="w-full mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm cursor-pointer"
						>
							{isSubmitting ? (
								<>
									<div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
									Registering...
								</>
							) : (
								'Register Company'
							)}
						</button>
					</form>
				</div>

				<p className="text-center text-sm mt-6">
					<Link to="/login" className="text-blue-200 hover:text-white font-medium">
						Already registered? Sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
